require('reflect-metadata');
const request = require('supertest');
const { ConfigService } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt');
const { HrModule } = require('../../dist/hr/hr.module');
const { PasswordService } = require('../../dist/auth/password.service');
const { createTestApplication } = require('./support/application.cjs');
const { createEmployeeFixtures, createHrFixtures } = require('./support/fixtures.cjs');
const { readContext, connectVerified, clearApplicationTables } = require('./support/database.cjs');

const ROUTES = ['requests', 'leave-balance/2026', 'onboarding-tasks'];

describe('HR REST endpoints with real PostgreSQL and authentication', () => {
    let context;
    let migration;
    let app;
    let employees;
    let hr;
    let tokens;

    beforeAll(async () => {
        context = readContext();
        migration = await connectVerified(context, 'migration');
        app = await createTestApplication(context, [HrModule]);
        employees = await createEmployeeFixtures(app.get(PasswordService), {
            hr: { id: 'a0000000-0000-4000-8000-000000000004', email: 'hr@example.invalid', status: 'active', role: 'hr' },
            admin: { id: 'a0000000-0000-4000-8000-000000000005', email: 'admin@example.invalid', status: 'active', role: 'admin' },
            other: { id: 'a0000000-0000-4000-8000-000000000006', email: 'other@example.invalid', status: 'active' },
        });
        hr = createHrFixtures(employees.employees);
    });

    function assertNoPrivateValues(response) {
        const privateValues = [...employees.sensitiveValues, ...hr.internalValues, app.get(ConfigService).get('JWT_SECRET')];
        expect(privateValues.every(value => !response.text.includes(value))).toBe(true);
    }

    async function login(employee) {
        const response = await request(app.getHttpServer()).post('/auth/login')
            .send({ workEmail: employee.email, password: employees.password });
        assertNoPrivateValues(response);
        expect(response.status).toBe(200);
        expect(Object.keys(response.body).sort()).toEqual(['accessToken', 'expiresIn', 'tokenType']);
        expect(response.body.tokenType === 'Bearer' && response.body.expiresIn === 900
            && typeof response.body.accessToken === 'string' && response.body.accessToken.length > 0).toBe(true);
        return response.body.accessToken;
    }

    async function reset(records) {
        await clearApplicationTables(migration, context);
        await employees.insert(migration, context);
        await hr.insert(migration, context, records);
    }

    beforeEach(async () => {
        await reset();
        // Reuse real login tokens while every guard rechecks the restored database employee.
        if (!tokens) {
            tokens = {};
            for (const role of ['active', 'hr', 'admin']) tokens[role] = await login(employees.employees[role]);
        }
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

    async function databaseState() {
        const state = {};
        for (const table of ['employees', 'hr_requests', 'leave_balances', 'onboarding_tasks', 'documents']) {
            // Only fingerprints reach assertion diagnostics, never stored credential values.
            state[table] = (await migration.query(`
                SELECT id, md5(row_to_json(record)::text) AS fingerprint
                FROM public.${table} record ORDER BY id
            `)).rows;
        }
        return state;
    }

    async function get(route, { employeeId = employees.employees.active.id, token = tokens.active, query = '' } = {}) {
        const before = await databaseState();
        let call = request(app.getHttpServer()).get(`/hr/employees/${encodeURIComponent(employeeId)}/${route}${query}`);
        if (token !== null) call = call.set('Authorization', `Bearer ${token}`);
        const response = await call;
        assertNoPrivateValues(response);
        // Every request, including validation and authorization failures, must leave all tables intact.
        expect(await databaseState()).toEqual(before);
        return response;
    }

    function expectPublicObject(actual, expected) {
        expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
        // Boolean assertions prevent accidental sensitive values in Jest failure diffs.
        expect(Object.entries(expected).every(([key, value]) => actual[key] === value)).toBe(true);
        expect(Object.entries(expected).every(([key, value]) => value === null
            ? actual[key] === null : typeof actual[key] === typeof value)).toBe(true);
    }

    function requestBody(row) {
        return { id: row.id, subject: row.subject, status: row.status };
    }

    function taskBody(row) {
        return { id: row.id, employeeId: row.employeeId, title: row.title, status: row.status, dueDate: row.dueDate };
    }

    function balanceBody(row) {
        return { employeeId: row.employeeId, year: row.year, entitledDays: row.entitledDays,
            usedDays: row.usedDays, remainingDays: row.entitledDays - row.usedDays };
    }

    function expectList(response, rows, project) {
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(rows.length);
        response.body.forEach((item, index) => expectPublicObject(item, project(rows[index])));
    }

    function expectOwnData(route, response) {
        if (route === 'requests') expectList(response, hr.requests.slice(0, 3), requestBody);
        else if (route === 'onboarding-tasks') expectList(response, hr.tasks.slice(0, 5), taskBody);
        else {
            expect(response.status).toBe(200);
            expectPublicObject(response.body, balanceBody(hr.balances[0]));
        }
    }

    function expectError(response, status, field) {
        expect(response.status).toBe(status);
        const hasError = status === 400 || status === 404;
        expect(Object.keys(response.body).sort()).toEqual(hasError ? ['error', 'message', 'statusCode'] : ['message', 'statusCode']);
        expect(response.body.statusCode === status).toBe(true);
        if (status === 400) {
            expect(response.body.error === 'Bad Request' && Array.isArray(response.body.message)).toBe(true);
            expect(response.body.message.every(message => typeof message === 'string')
                && response.body.message.some(message => message.includes(field))).toBe(true);
        } else if (status === 404) {
            // This literal is the existing API message, not a new application message.
            expect(response.body.error === 'Not Found'
                && response.body.message === 'Баланс отпуска за указанный год не найден.').toBe(true);
        } else expect(response.body.message === (status === 401 ? 'Unauthorized' : 'Forbidden')).toBe(true);
    }

    describe('HR requests', () => {
        test('returns only own requests ordered by creation descending and UUID ascending', async () => {
            expectOwnData('requests', await get('requests'));
            expect((await databaseState()).hr_requests.length).toBe(4);
        });

        test('returns an empty array when only another employee has requests', async () => {
            await reset({ requests: [hr.requests[3]] });
            expectList(await get('requests'), [], requestBody);
            expect((await databaseState()).hr_requests.length).toBe(1);
        });

        test('filters by owner before applying the 100-record limit and preserves all rows', async () => {
            const rows = Array.from({ length: 101 }, (_, index) => ({
                ...hr.requests[0], id: `10000000-0000-4000-8000-${(index + 1).toString(16).padStart(12, '0')}`,
                subject: `Limit request ${index}`, createdAt: '2026-01-05T00:00:00Z',
            }));
            await reset({ requests: [hr.requests[3], ...rows.toReversed()] });
            expectList(await get('requests'), rows.slice(0, 100), requestBody);
            expect((await databaseState()).hr_requests.length).toBe(102);
        });
    });

    describe('Leave balances', () => {
        test.each([2026, 2027, 2028, 2000, 2100])('returns numeric entitlement, usage and remaining days for year %i', async year => {
            const response = await get(`leave-balance/${year}`);
            expect(response.status).toBe(200);
            expectPublicObject(response.body, balanceBody(hr.balances.find(row => row.year === year)));
        });

        test('accepts a decimal year with leading zeros', async () => {
            expectOwnData('leave-balance/2026', await get('leave-balance/02026'));
        });

        test('returns 404 for a missing year instead of a zero balance', async () => {
            expectError(await get('leave-balance/2029'), 404);
        });

        test.each(['hr', 'admin'])('allows %s to read only its own missing balance', async role => {
            expectError(await get('leave-balance/2026', { employeeId: employees.employees[role].id, token: tokens[role] }), 404);
        });

        test.each(['invalid', '1999', '2101', '2026.0', '2026.5', '0x7ea', '2.026e3', '+2026', ' 2026', '2026 ', '-2026'])(
            'rejects invalid raw year %s without changing data', async year => {
                expectError(await get(`leave-balance/${encodeURIComponent(year)}`), 400, 'year');
            },
        );
    });

    describe('Onboarding tasks', () => {
        test('returns only own tasks ordered by date, nulls last, then UUID with all supported statuses', async () => {
            expectOwnData('onboarding-tasks', await get('onboarding-tasks'));
            expect((await databaseState()).onboarding_tasks.length).toBe(6);
        });

        test('returns an empty array when only another employee has tasks', async () => {
            await reset({ tasks: [hr.tasks[5]] });
            expectList(await get('onboarding-tasks'), [], taskBody);
            expect((await databaseState()).onboarding_tasks.length).toBe(1);
        });

        test('filters by owner before applying the 100-record limit and preserves all rows', async () => {
            const rows = Array.from({ length: 101 }, (_, index) => ({
                ...hr.tasks[0], id: `20000000-0000-4000-8000-${(index + 1).toString(16).padStart(12, '0')}`,
                title: `Limit task ${index}`, dueDate: '2026-01-05',
            }));
            await reset({ tasks: [hr.tasks[5], ...rows.toReversed()] });
            expectList(await get('onboarding-tasks'), rows.slice(0, 100), taskBody);
            expect((await databaseState()).onboarding_tasks.length).toBe(102);
        });
    });

    describe.each(ROUTES)('Security and validation: %s', route => {
        test('returns 401 without a token', async () => {
            expectError(await get(route, { token: null }), 401);
        });

        test('returns 401 for an invalid JWT', async () => {
            expectError(await get(route, { token: 'invalid-token' }), 401);
        });

        test('returns 401 for a signed expired JWT', async () => {
            const token = await app.get(JwtService).signAsync({ sub: employees.employees.active.id }, { expiresIn: -1 });
            expectError(await get(route, { token }), 401);
        });

        test.each(['active', 'hr', 'admin'])('returns 403 when the %s account requests another employee', async role => {
            expectError(await get(route, { employeeId: employees.employees.other.id, token: tokens[role] }), 403);
        });

        if (route !== 'leave-balance/2026') {
            test.each(['hr', 'admin'])('allows the %s account to read its own empty list', async role => {
                expectList(await get(route, { employeeId: employees.employees[role].id, token: tokens[role] }), [],
                    route === 'requests' ? requestBody : taskBody);
            });
        }

        test.each(['invalid', 'a0000000-0000-3000-8000-000000000001', 'a0000000-0000-4000-0000-000000000001'])(
            'rejects invalid UUID %s before ownership checking', async employeeId => {
                expectError(await get(route, { employeeId }), 400, 'employeeId');
            },
        );

        test('accepts an uppercase UUID belonging to the authenticated employee', async () => {
            expectOwnData(route, await get(route, { employeeId: employees.employees.active.id.toUpperCase() }));
        });

        test('ignores an attempted employee identity override in the query string', async () => {
            expectOwnData(route, await get(route, { query: `?employeeId=${employees.employees.other.id}` }));
        });
    });
});
