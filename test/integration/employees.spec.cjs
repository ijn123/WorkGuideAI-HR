require('reflect-metadata');
const request = require('supertest');
const { ConfigService } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt');
const { EmployeesModule } = require('../../dist/employees/employees.module');
const { EmployeesService } = require('../../dist/employees/employees.service');
const { PasswordService } = require('../../dist/auth/password.service');
const { createTestApplication } = require('./support/application.cjs');
const { createEmployeeFixtures } = require('./support/fixtures.cjs');
const { readContext, connectVerified, clearApplicationTables, assertDatabaseIdentity } = require('./support/database.cjs');

describe('GET /employees with real PostgreSQL and authentication', () => {
    let context;
    let migration;
    let app;
    let fixtures;
    let initialState;

    beforeAll(async () => {
        context = readContext();
        migration = await connectVerified(context, 'migration');
        // EmployeesModule imports the real AuthModule and DatabaseModule.
        app = await createTestApplication(context, [EmployeesModule]);
        fixtures = await createEmployeeFixtures(app.get(PasswordService), {
            hr: { id: 'a0000000-0000-4000-8000-000000000004', email: 'hr@example.invalid', status: 'active',
                role: 'hr', firstName: 'Harper', lastName: 'zz-auth' },
            admin: { id: 'a0000000-0000-4000-8000-000000000005', email: 'admin@example.invalid', status: 'active',
                role: 'admin', firstName: 'Alex', lastName: 'zz-auth' },
        });
    });

    async function databaseState() {
        // Fingerprints detect changes without returning password hashes to Jest.
        const { rows } = await migration.query(`
            SELECT id, md5(row_to_json(employees)::text) AS fingerprint
            FROM public.employees ORDER BY id
        `);
        return rows;
    }

    beforeEach(async () => {
        await clearApplicationTables(migration, context);
        await fixtures.insert(migration, context);
        initialState = await databaseState();
        expect(initialState.length).toBe(5);
    });

    afterEach(async () => {
        if (migration) await clearApplicationTables(migration, context);
    });

    afterAll(async () => {
        try { await app?.close(); }
        finally {
            try { if (migration) await clearApplicationTables(migration, context); }
            finally { await migration?.end(); }
        }
    });

    function assertNoCredentialValues(response) {
        const secrets = [...fixtures.sensitiveValues, app.get(ConfigService).get('JWT_SECRET')];
        expect(secrets.every(value => !response.text.includes(value))).toBe(true);
    }

    async function tokenFor(employee) {
        const response = await request(app.getHttpServer()).post('/auth/login')
            .send({ workEmail: employee.email, password: fixtures.password });
        assertNoCredentialValues(response);
        expect(response.status).toBe(200);
        expect(Object.keys(response.body).sort()).toEqual(['accessToken', 'expiresIn', 'tokenType']);
        expect(response.body.tokenType === 'Bearer' && response.body.expiresIn === 900).toBe(true);
        expect(typeof response.body.accessToken === 'string' && response.body.accessToken.length > 0).toBe(true);
        return response.body.accessToken;
    }

    async function getEmployees(token) {
        let call = request(app.getHttpServer()).get('/employees');
        if (token !== undefined) call = call.set('Authorization', `Bearer ${token}`);
        const before = await databaseState();
        const response = await call;
        assertNoCredentialValues(response);
        expect(await databaseState()).toEqual(before);
        return response;
    }

    function expectError(response, status, message) {
        expect(response.status).toBe(status);
        // AuthGuard throws UnauthorizedException without a custom message: Nest omits error.
        expect(Object.keys(response.body).sort()).toEqual(status === 401
            ? ['message', 'statusCode'] : ['error', 'message', 'statusCode']);
        expect(response.body.statusCode === status && response.body.message === message
            && response.body.error === (status === 401 ? undefined : 'Forbidden')).toBe(true);
    }

    function publicEmployee(employee) {
        return { id: employee.id, firstName: employee.firstName, lastName: employee.lastName,
            workEmail: employee.email, department: employee.department };
    }

    function expectEmployees(response, expected) {
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(expected.length);
        for (const employee of response.body) {
            // Exact keys exclude hashes, roles, employment status, timestamps and SQL column names.
            expect(Object.keys(employee).sort()).toEqual(['department', 'firstName', 'id', 'lastName', 'workEmail']);
            expect(Object.values(employee).every(value => typeof value === 'string' && value.length > 0)).toBe(true);
            expect(/^[0-9a-f-]{36}$/.test(employee.id)).toBe(true);
        }
        // Avoid printing unexpected response values, including credentials, on assertion failure.
        expect(response.body.every((employee, index) => Object.entries(publicEmployee(expected[index]))
            .every(([key, value]) => employee[key] === value))).toBe(true);
    }

    function baselineOrder() {
        const { active, inactive, unprovisioned, admin, hr } = fixtures.employees;
        return [active, inactive, unprovisioned, admin, hr];
    }

    test.each(['hr', 'admin'])('allows an authenticated %s account and returns only public employee fields', async role => {
        const token = await tokenFor(fixtures.employees[role]);
        expectEmployees(await getEmployees(token), baselineOrder());
        expect(await databaseState()).toEqual(initialState);
    });

    test('forbids an authenticated employee account', async () => {
        expectError(await getEmployees(await tokenFor(fixtures.employees.active)), 403, 'Forbidden resource');
    });

    test('rejects a request without an access token', async () => {
        expectError(await getEmployees(), 401, 'Unauthorized');
    });

    test('rejects a malformed JWT', async () => {
        expectError(await getEmployees('invalid-token'), 401, 'Unauthorized');
    });

    test('rejects a login token with a tampered signature', async () => {
        const parts = (await tokenFor(fixtures.employees.hr)).split('.');
        parts[2] = (parts[2][0] === 'A' ? 'B' : 'A') + parts[2].slice(1);
        expectError(await getEmployees(parts.join('.')), 401, 'Unauthorized');
    });

    test('rejects a genuinely signed expired JWT without replacing the clock', async () => {
        const token = await app.get(JwtService).signAsync({ sub: fixtures.employees.hr.id }, { expiresIn: -1 });
        expectError(await getEmployees(token), 401, 'Unauthorized');
    });

    test('rejects a previously issued token when the employees table is empty', async () => {
        const token = await tokenFor(fixtures.employees.hr);
        await clearApplicationTables(migration, context);
        expect((await databaseState()).length).toBe(0);
        expectError(await getEmployees(token), 401, 'Unauthorized');
        // A public 200 [] is unreachable: AuthGuard requires an active database employee.
        expect(await app.get(EmployeesService).findAll()).toEqual([]);
    });

    test('orders by last name, then first name, then UUID rather than insertion order', async () => {
        const base = fixtures.employees.active;
        const profiles = [
            { ...base, id: 'b0000000-0000-4000-8000-000000000001', email: 'order1@example.invalid', firstName: 'amy', lastName: 'adams' },
            { ...base, id: 'b0000000-0000-4000-8000-000000000002', email: 'order2@example.invalid', firstName: 'amy', lastName: 'adams' },
            { ...base, id: 'b0000000-0000-4000-8000-000000000003', email: 'order3@example.invalid', firstName: 'zoe', lastName: 'adams' },
            { ...base, id: 'b0000000-0000-4000-8000-000000000004', email: 'order4@example.invalid', firstName: 'amy', lastName: 'baker' },
        ];
        await clearApplicationTables(migration, context);
        await fixtures.insert(migration, context, [fixtures.employees.hr, ...profiles.toReversed()]);
        expectEmployees(await getEmployees(await tokenFor(fixtures.employees.hr)), [...profiles, fixtures.employees.hr]);
    });

    test('returns the first 100 ordered employees while leaving all database rows intact', async () => {
        const profiles = Array.from({ length: 101 }, (_, index) => ({
            ...fixtures.employees.active,
            id: `c0000000-0000-4000-8000-${(index + 1).toString(16).padStart(12, '0')}`,
            email: `limit${index}@example.invalid`, firstName: 'Limit', lastName: `row${String(index).padStart(3, '0')}`,
        }));
        await clearApplicationTables(migration, context);
        await fixtures.insert(migration, context, [fixtures.employees.hr, ...profiles.toReversed()]);
        const response = await getEmployees(await tokenFor(fixtures.employees.hr));
        expectEmployees(response, profiles.slice(0, 100));
        expect((await databaseState()).length).toBe(102);
    });

    test('restores baseline fixtures without rows left by other tests', async () => {
        expectEmployees(await getEmployees(await tokenFor(fixtures.employees.hr)), baselineOrder());
        expect(await databaseState()).toEqual(initialState);
    });

    test('uses the current database role after a token has been issued', async () => {
        const token = await tokenFor(fixtures.employees.hr);
        await assertDatabaseIdentity(migration, context, 'migration');
        await migration.query('UPDATE public.employees SET role = $1 WHERE id = $2', ['employee', fixtures.employees.hr.id]);
        expectError(await getEmployees(token), 403, 'Forbidden resource');
    });
});
