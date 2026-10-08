const assert = require('node:assert/strict');
const { after, before, beforeEach, describe, it, mock } = require('node:test');
const fixtures = require('./fixtures.cjs');
const { Module, NotFoundException, ServiceUnavailableException } = require('@nestjs/common');
const { ConfigModule } = require('@nestjs/config');
const { NestFactory } = require('@nestjs/core');
const { JwtService } = require('@nestjs/jwt');
const { AuthModule } = require('../../dist/auth/auth.module');
const { PasswordService } = require('../../dist/auth/password.service');
const { AppController } = require('../../dist/app.controller');
const { EmployeesModule } = require('../../dist/employees/employees.module');
const { EmployeesService } = require('../../dist/employees/employees.service');
const { HrModule } = require('../../dist/hr/hr.module');
const { LeaveBalancesService } = require('../../dist/hr/leave-balances.service');
const { HrRequestsService } = require('../../dist/hr/hr-requests.service');
const { OnboardingTasksService } = require('../../dist/hr/onboarding-tasks.service');
const { ChatModule } = require('../../dist/chat/chat.module');
const { QuestionOrchestratorService } = require('../../dist/chat/question-orchestrator.service');
const { DatabaseService } = require('../../dist/database/database.service');

describe('Authentication endpoint integration', { concurrency: false }, () => {
    let app, baseUrl, token, databaseError, serviceError;
    let employeeStatus = 'active';
    let employeeExists = true;
    let employeeRole = 'employee';
    const calls = [];
    const routes = [
        ['leave', '/leave-balance/2026'],
        ['requests', '/requests'],
        ['onboarding', '/onboarding-tasks'],
    ];

    before(async () => {
        const hash = await new PasswordService().hash(fixtures.PASSWORD);
        mock.method(DatabaseService.prototype, 'onModuleInit', async () => {});
        // Exercise the real AuthRepository while replacing its database boundary.
        mock.method(DatabaseService.prototype, 'query', async (sql, params) => {
            if (databaseError) throw databaseError;
            if (sql.includes('lower(work_email)')) {
                return params[0] === fixtures.EMAIL
                    ? [{ id: fixtures.EMPLOYEE_ID, role: employeeRole, password_hash: hash, employment_status: employeeStatus }]
                    : [];
            }
            if (sql.includes('WHERE id = $1')) {
                return employeeExists && params[0] === fixtures.EMPLOYEE_ID
                    ? [{ id: fixtures.EMPLOYEE_ID, employment_status: employeeStatus, role: employeeRole }]
                    : [];
            }
            throw new Error('Unexpected SQL in the offline test');
        });
        mock.method(EmployeesService.prototype, 'findAll', async () => {
            calls.push(['employees']);
            if (serviceError) throw serviceError;
            return [];
        });
        mock.method(QuestionOrchestratorService.prototype, 'ask', async (question, user) => {
            calls.push(['chat', question, user]);
            if (serviceError) throw serviceError;
            return {
                route: 'CLARIFICATION',
                question: 'Уточните ваш вопрос.',
            };
        });
        for (const [Service, method, name] of [
            [LeaveBalancesService, 'getLeaveBalance', 'leave'],
            [HrRequestsService, 'findRequestsByEmployeeId', 'requests'],
            [OnboardingTasksService, 'findOnboardingTasksByEmployeeId', 'onboarding'],
        ]) {
            mock.method(Service.prototype, method, async (...args) => {
                calls.push([name, ...args]);
                if (serviceError) throw serviceError;
                return name === 'leave'
                    ? {
                        employeeId: args[0],
                        year: args[1],
                        entitledDays: 25,
                        usedDays: 5,
                        remainingDays: 20,
                    }
                    : [];
            });
        }
        class TestModule {}
        Module({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    ignoreEnvFile: true,
                    ignoreEnvVars: true,
                    skipProcessEnv: true,
                    load: [fixtures.environment],
                }),
                AuthModule, EmployeesModule, HrModule, ChatModule,
            ],
            controllers: [AppController],
        })(TestModule);
        app = await NestFactory.create(TestModule, { logger: false, abortOnError: false });
        await app.listen(0, '127.0.0.1');
        baseUrl = await app.getUrl();
        token = app.get(JwtService).sign({ sub: fixtures.EMPLOYEE_ID });
    });

    after(async () => {
        try { if (app) await app.close(); }
        finally { mock.restoreAll(); }
    });

    beforeEach(() => {
        calls.length = 0;
        databaseError = serviceError = undefined;
        employeeStatus = 'active';
        employeeExists = true;
        employeeRole = 'employee';
    });

    async function http(method, path, jwt = token, body) {
        const headers = {};
        if (jwt !== null) headers.authorization = `Bearer ${jwt}`;
        if (body !== undefined) headers['content-type'] = 'application/json';
        const response = await fetch(baseUrl + path, {
            method,
            headers,
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
        return { status: response.status, body: await response.json() };
    }

    it('keeps root and login public and uses AuthModule JWT configuration', async () => {
        assert.equal((await http('GET', '/', null)).status, 200);
        const login = await http('POST', '/auth/login', null, {
            workEmail: ` ${fixtures.EMAIL.toUpperCase()} `,
            password: fixtures.PASSWORD,
        });
        assert.equal(login.status, 200);
        assert.equal(login.body.tokenType, 'Bearer');
        assert.equal(login.body.expiresIn, fixtures.TTL);
        const jwt = app.get(JwtService);
        const verified = jwt.verify(login.body.accessToken, { algorithms: ['HS256'], complete: true });
        assert.equal(verified.header.alg, 'HS256');
        assert.equal(verified.payload.exp - verified.payload.iat, fixtures.TTL);
        assert.deepEqual(Object.keys(verified.payload).sort(), ['exp', 'iat', 'sub']);
        assert.equal((await http('GET', '/employees', login.body.accessToken)).status, 403);
        assert.equal((await http('POST', '/auth/login', null, {})).status, 400);
        assert.equal((await http('POST', '/auth/login', null, { workEmail: 'unknown@example.invalid', password: fixtures.PASSWORD })).status, 401);
    });

    for (const [method, path, body, handler] of [
        ['GET', '/employees', undefined, 'employees'],
        ['POST', '/chat', { question: ' Test question ' }, 'chat'],
    ]) {
        it(`protects ${method} ${path} and preserves successful handler behavior`, async () => {
            for (const jwt of [null, 'invalid', app.get(JwtService).sign({ sub: fixtures.EMPLOYEE_ID }, { expiresIn: -1 })]) {
                assert.equal((await http(method, path, jwt, body)).status, 401);
                assert.equal(calls.length, 0);
            }
            if (path === '/employees') employeeRole = 'hr';
            const result = await http(method, path, token, body);
            assert.equal(result.status, method === 'POST' ? 201 : 200);
            assert.equal(calls[0][0], handler);
            if (path === '/chat') {
                assert.deepEqual(calls, [
                    ['chat', 'Test question', {
                        employeeId: fixtures.EMPLOYEE_ID,
                        role: 'employee',
                    }],
                ]);
            }
            mock.method(QuestionOrchestratorService.prototype, 'ask', async (question, user) => {
                calls.push(['chat', question, user]);
                if (serviceError) throw serviceError;
                return {
                    route: 'CLARIFICATION',
                    question: 'Уточните ваш вопрос.',
                };
            });
        });
    }

    for (const [name, suffix] of routes) {
        it(`protects HR ${name}, enforces ownership and preserves UUID v4 validation`, async () => {
            const path = id => `/hr/employees/${id}${suffix}`;
            for (const jwt of [null, 'invalid']) {
                assert.equal((await http('GET', path(fixtures.EMPLOYEE_ID), jwt)).status, 401);
                assert.equal(calls.length, 0);
            }
            for (const id of [fixtures.EMPLOYEE_ID, fixtures.EMPLOYEE_ID.toUpperCase()]) {
                calls.length = 0;
                assert.equal((await http('GET', path(id) + `?employeeId=${fixtures.OTHER_EMPLOYEE_ID}`)).status, 200);
                assert.deepEqual(calls, [name === 'leave'
                    ? [name, fixtures.EMPLOYEE_ID, 2026]
                    : [name, fixtures.EMPLOYEE_ID]]);
            }
            calls.length = 0;
            assert.equal((await http('GET', path(fixtures.OTHER_EMPLOYEE_ID))).status, 403);
            assert.equal(calls.length, 0);
            for (const id of ['invalid', '8f1c3b24-1234-3567-89ab-123456789abc']) {
                assert.equal((await http('GET', path(id))).status, 400);
                assert.equal(calls.length, 0);
            }
        });
    }

    it('does not allow employee, HR or admin roles to bypass HR ownership', async () => {
        for (const role of ['employee', 'hr', 'admin']) {
            employeeRole = role;
            for (const [, suffix] of routes) {
                assert.equal((await http('GET', `/hr/employees/${fixtures.OTHER_EMPLOYEE_ID}${suffix}`)).status, 403);
                assert.equal(calls.length, 0);
            }
        }
    });

    it('rejects inactive and nonexistent employees on every protected route', async () => {
        for (const state of ['inactive', 'nonexistent']) {
            employeeStatus = state === 'inactive' ? 'inactive' : 'active';
            employeeExists = state !== 'nonexistent';
            for (const [method, path, body] of [
                ['GET', '/employees'], ['POST', '/chat', { question: 'Test' }],
                ...routes.map(([, suffix]) => ['GET', `/hr/employees/${fixtures.EMPLOYEE_ID}${suffix}`]),
            ]) {
                assert.equal((await http(method, path, token, body)).status, 401);
                assert.equal(calls.length, 0);
            }
        }
    });

    it('preserves request validation and normal infrastructure error handling', async () => {
        assert.equal((await http('POST', '/chat', token, {})).status, 400);
        for (const year of ['invalid', '1999', '2101']) {
            assert.equal((await http('GET', `/hr/employees/${fixtures.EMPLOYEE_ID}/leave-balance/${year}`)).status, 400);
        }
        assert.equal(calls.length, 0);
        databaseError = new Error('Fake database failure');
        assert.equal((await http('GET', '/employees')).status, 500);
        databaseError = undefined;
        serviceError = new NotFoundException();
        assert.equal((await http('GET', `/hr/employees/${fixtures.EMPLOYEE_ID}/leave-balance/2026`)).status, 404);
        serviceError = new Error('Fake HR failure');
        assert.equal((await http('GET', `/hr/employees/${fixtures.EMPLOYEE_ID}/requests`)).status, 500);
        serviceError = new ServiceUnavailableException();
        assert.equal((await http('POST', '/chat', token, { question: 'Test' })).status, 503);
    });
});
