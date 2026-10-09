require('reflect-metadata');
const request = require('supertest');
const { ConfigService } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt');
const { AuthModule } = require('../../dist/auth/auth.module');
const { PasswordService } = require('../../dist/auth/password.service');
const { createTestApplication } = require('./support/application.cjs');
const { createEmployeeFixtures } = require('./support/fixtures.cjs');
const { readContext, connectVerified, clearApplicationTables } = require('./support/database.cjs');

describe('POST /auth/login with real PostgreSQL', () => {
    let context;
    let migration;
    let app;
    let fixtures;

    beforeAll(async () => {
        context = readContext();
        migration = await connectVerified(context, 'migration');
        app = await createTestApplication(context, [AuthModule]);
        fixtures = await createEmployeeFixtures(app.get(PasswordService));
    });

    beforeEach(async () => {
        await clearApplicationTables(migration, context);
        await fixtures.insert(migration, context);
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

    function validBody(employee = fixtures.employees.active) {
        return { workEmail: employee.email, password: fixtures.password };
    }

    async function login(body) {
        const response = await request(app.getHttpServer()).post('/auth/login').send(body);
        const sensitive = [...fixtures.sensitiveValues, app.get(ConfigService).get('JWT_SECRET')];
        if (typeof body?.password === 'string' && body.password) sensitive.push(body.password);
        // Boolean assertions keep credentials and unexpected response values out of Jest diffs.
        expect(sensitive.every(value => !response.text.includes(value))).toBe(true);
        const forbidden = new Set(['password', 'passwordhash', 'password_hash', 'jwtsecret', 'jwt_secret', 'secret']);
        function hasSensitiveField(value) {
            return value !== null && typeof value === 'object'
                && Object.entries(value).some(([key, item]) => forbidden.has(key.toLowerCase()) || hasSensitiveField(item));
        }
        expect(hasSensitiveField(response.body)).toBe(false);
        return response;
    }

    async function expectSuccessfulLogin(body) {
        const response = await login(body);
        expect(response.status).toBe(200);
        expect(Object.keys(response.body).sort()).toEqual(['accessToken', 'expiresIn', 'tokenType']);
        expect(response.body.tokenType === 'Bearer' && response.body.expiresIn === 900).toBe(true);
        expect(typeof response.body.accessToken === 'string' && response.body.accessToken.length > 0).toBe(true);
        let verified;
        try {
            verified = await app.get(JwtService).verifyAsync(response.body.accessToken, { algorithms: ['HS256'], complete: true });
        } catch {
            throw new Error('Login returned an invalid signed JWT.');
        }
        expect(verified.header.alg).toBe('HS256');
        expect(Object.keys(verified.payload).sort()).toEqual(['exp', 'iat', 'sub']);
        expect(verified.payload.sub).toBe(fixtures.employees.active.id);
        expect(Number.isInteger(verified.payload.iat) && Number.isInteger(verified.payload.exp)).toBe(true);
        expect(verified.payload.exp - verified.payload.iat).toBe(900);
    }

    async function expectUnauthorized(body) {
        const response = await login(body);
        expect(response.status).toBe(401);
        expect(Object.keys(response.body).sort()).toEqual(['error', 'message', 'statusCode']);
        expect(response.body.statusCode === 401 && response.body.error === 'Unauthorized'
            && response.body.message === 'Invalid credentials.').toBe(true);
    }

    function expectValidationError(response, messages) {
        expect(response.status).toBe(400);
        expect(Object.keys(response.body).sort()).toEqual(['error', 'message', 'statusCode']);
        expect(response.body.statusCode === 400 && response.body.error === 'Bad Request').toBe(true);
        expect(Array.isArray(response.body.message)).toBe(true);
        expect(response.body.message.every(message => typeof message === 'string')).toBe(true);
        // Check the relevant constraints without printing unexpected response values.
        expect(messages.every(message => response.body.message.includes(message))).toBe(true);
    }

    test('returns a signed Bearer token for an active employee', async () => {
        await expectSuccessfulLogin(validBody());
    });

    test('normalizes surrounding whitespace and case in the email', async () => {
        await expectSuccessfulLogin({ ...validBody(), workEmail: ` \t${fixtures.employees.active.email.toUpperCase()}\n ` });
    });

    test('rejects an incorrect password', async () => {
        await expectUnauthorized({ ...validBody(), password: `${fixtures.password}incorrect` });
    });

    test('preserves significant whitespace in the password', async () => {
        await expectUnauthorized({ ...validBody(), password: fixtures.password.trim() });
    });

    test('rejects an unknown employee', async () => {
        await expectUnauthorized({ ...validBody(), workEmail: 'unknown.employee@example.invalid' });
    });

    test('rejects an inactive employee with the correct password', async () => {
        await expectUnauthorized(validBody(fixtures.employees.inactive));
    });

    test('rejects an employee without a provisioned password hash', async () => {
        await expectUnauthorized(validBody(fixtures.employees.unprovisioned));
    });

    test.each([
        ['plain text', 'invalid', ['workEmail must be an email']],
        ['consecutive dots', 'a..b@example.invalid', ['workEmail must be an email']],
        ['whitespace only', '   ', ['workEmail must be an email', 'workEmail should not be empty']],
    ])('rejects an invalid email: %s', async (_name, workEmail, messages) => {
        const response = await login({ ...validBody(), workEmail });
        expectValidationError(response, messages);
    });

    test.each([
        ['empty body', () => ({}), ['workEmail should not be empty', 'password should not be empty']],
        ['missing email', body => ({ password: body.password }), ['workEmail should not be empty']],
        ['missing password', body => ({ workEmail: body.workEmail }), ['password should not be empty']],
        ['null email', body => ({ ...body, workEmail: null }), ['workEmail must be a string', 'workEmail should not be empty']],
        ['numeric email', body => ({ ...body, workEmail: 42 }), ['workEmail must be a string']],
        ['array email', body => ({ ...body, workEmail: [body.workEmail] }), ['workEmail must be a string']],
        ['oversized email', body => ({ ...body, workEmail: `${'a'.repeat(255)}@example.invalid` }), ['workEmail must be shorter than or equal to 254 characters']],
        ['null password', body => ({ ...body, password: null }), ['password must be a string', 'password should not be empty']],
        ['numeric password', body => ({ ...body, password: 42 }), ['password must be a string']],
        ['array password', body => ({ ...body, password: [] }), ['password must be a string']],
        ['empty password', body => ({ ...body, password: '' }), ['password should not be empty']],
        ['oversized UTF-8 password', body => ({ ...body, password: '😀'.repeat(257) }), ['Password must not exceed 1024 UTF-8 bytes.']],
        ['unknown property', body => ({ ...body, unexpected: true }), ['property unexpected should not exist']],
        ['array body', body => [body], ['property 0 should not exist', 'workEmail should not be empty', 'password should not be empty']],
    ])('rejects invalid request data: %s', async (_name, change, messages) => {
        const response = await login(change(validBody()));
        expectValidationError(response, messages);
    });
});
