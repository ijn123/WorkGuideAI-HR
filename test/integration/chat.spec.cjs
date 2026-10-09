require('reflect-metadata');
// Mock transport SDKs before loading application modules; all NestJS providers stay real.
jest.mock('@langchain/google', () => ({ ChatGoogle: require('./support/chat-externals.cjs').ChatGoogle }));
jest.mock('@langchain/google-genai', () => ({ GoogleGenerativeAIEmbeddings: require('./support/chat-externals.cjs').GoogleGenerativeAIEmbeddings }));
jest.mock('@qdrant/js-client-rest', () => ({ QdrantClient: require('./support/chat-externals.cjs').QdrantClient }));

const request = require('supertest');
const { ConfigService } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt');
const { ChatModule } = require('../../dist/chat/chat.module');
const { PasswordService } = require('../../dist/auth/password.service');
const { createTestApplication } = require('./support/application.cjs');
const { createEmployeeFixtures, createHrFixtures, createDocumentFixture } = require('./support/fixtures.cjs');
const { readContext, connectVerified, clearApplicationTables } = require('./support/database.cjs');
const external = require('./support/chat-externals.cjs');

const QUESTION = 'What is my HR information?';
const OPERATIONS = [{ operation: 'LEAVE_BALANCE', year: 2026 }, { operation: 'HR_REQUESTS' }, { operation: 'ONBOARDING_TASKS' }];
const INSUFFICIENT = { status: 'SUCCESS', data: {
    answer: 'В доступных документах недостаточно информации для ответа.', insufficientInformation: true, sources: [],
} };

describe('POST /chat with real routing, HR operations, PostgreSQL and authentication', () => {
    let context;
    let migration;
    let app;
    let employees;
    let hr;
    let tokens;
    const document = createDocumentFixture();

    beforeAll(async () => {
        context = readContext();
        migration = await connectVerified(context, 'migration');
        app = await createTestApplication(context, [ChatModule]);
        employees = await createEmployeeFixtures(app.get(PasswordService), {
            other: { id: 'a0000000-0000-4000-8000-000000000006', email: 'other@example.invalid', status: 'active' },
            hr: { id: 'a0000000-0000-4000-8000-000000000004', email: 'hr@example.invalid', status: 'active', role: 'hr' },
            admin: { id: 'a0000000-0000-4000-8000-000000000005', email: 'admin@example.invalid', status: 'active', role: 'admin' },
        });
        hr = createHrFixtures(employees.employees);
    });

    function assertPrivateValuesAbsent(response) {
        const config = app.get(ConfigService);
        const values = [...employees.sensitiveValues, ...hr.internalValues, config.get('JWT_SECRET'), config.get('GEMINI_API_KEY')];
        expect(values.every(value => !response.text.includes(value))).toBe(true);
    }

    beforeEach(async () => {
        external.reset();
        await clearApplicationTables(migration, context);
        await employees.insert(migration, context);
        await hr.insert(migration, context);
        if (!tokens) {
            tokens = {};
            for (const name of ['active', 'other', 'hr', 'admin']) {
                const response = await request(app.getHttpServer()).post('/auth/login')
                    .send({ workEmail: employees.employees[name].email, password: employees.password });
                assertPrivateValuesAbsent(response);
                expect(response.status).toBe(200);
                expect(Object.keys(response.body).sort()).toEqual(['accessToken', 'expiresIn', 'tokenType']);
                expect(response.body.tokenType === 'Bearer' && response.body.expiresIn === 900
                    && typeof response.body.accessToken === 'string').toBe(true);
                tokens[name] = response.body.accessToken;
            }
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
            // Fingerprints detect writes without exposing credentials in failure diffs.
            state[table] = (await migration.query(`
                SELECT id, md5(row_to_json(record)::text) AS fingerprint
                FROM public.${table} record ORDER BY id
            `)).rows;
        }
        return state;
    }

    async function post(body = { question: QUESTION }, token = tokens.active) {
        const before = await databaseState();
        let call = request(app.getHttpServer()).post('/chat');
        if (token !== null) call = call.set('Authorization', `Bearer ${token}`);
        const response = await call.send(body);
        assertPrivateValuesAbsent(response);
        expect(await databaseState()).toEqual(before);
        return response;
    }

    function expectBody(actual, expected) {
        // Exact keys, array order, values and types; never print response values in diffs.
        if (Array.isArray(expected)) {
            expect(Array.isArray(actual)).toBe(true);
            expect(actual.length).toBe(expected.length);
            expected.forEach((value, index) => expectBody(actual[index], value));
        } else if (expected !== null && typeof expected === 'object') {
            expect(actual !== null && typeof actual === 'object' && !Array.isArray(actual)).toBe(true);
            expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
            Object.entries(expected).forEach(([key, value]) => expectBody(actual[key], value));
        } else expect(actual === expected).toBe(true);
    }

    function results(owner = employees.employees.active.id, operations = OPERATIONS) {
        return operations.map(operation => {
            let data;
            if (operation.operation === 'LEAVE_BALANCE') {
                const row = hr.balances.find(item => item.employeeId === owner && item.year === operation.year);
                if (!row) return { ...operation, status: 'NOT_FOUND' };
                data = { employeeId: owner, year: row.year, entitledDays: row.entitledDays,
                    usedDays: row.usedDays, remainingDays: row.entitledDays - row.usedDays };
            } else if (operation.operation === 'HR_REQUESTS') {
                data = hr.requests.filter(row => row.employeeId === owner)
                    .map(({ id, subject, status }) => ({ id, subject, status }));
            } else {
                data = hr.tasks.filter(row => row.employeeId === owner)
                    .map(({ id, employeeId, title, status, dueDate }) => ({ id, employeeId, title, status, dueDate }));
            }
            return { operation: operation.operation, status: 'SUCCESS', data };
        });
    }

    function route(operations = OPERATIONS) {
        external.state.decision = { route: 'SQL', operations };
    }

    function expectSuccess(response, result, question = QUESTION) {
        expect(response.status).toBe(201);
        expectBody(response.body, { question, result });
    }

    function expectRoutingOnly(question = QUESTION) {
        expect(external.state.calls.map(call => call.kind)).toEqual(['routing']);
        expectBody(external.state.calls[0].input, { question, currentYear: new Date().getUTCFullYear() });
    }

    test.each(OPERATIONS)('executes $operation through the real HR repository', async operation => {
        route([operation]);
        expectSuccess(await post(), { route: 'SQL', hr: results(undefined, [operation]) });
        expectRoutingOnly();
    });

    test('preserves the requested operation order and complete public DTOs', async () => {
        const operations = OPERATIONS.toReversed();
        route(operations);
        expectSuccess(await post(), { route: 'SQL', hr: results(undefined, operations) });
        expectRoutingOnly();
    });

    test('uses replacement PostgreSQL fixtures with the same external routing reply', async () => {
        route();
        expectSuccess(await post(), { route: 'SQL', hr: results() });
        const replacement = {
            balances: [{ ...hr.balances[0], entitledDays: 28.5, usedDays: 12.5 }],
            requests: [{ ...hr.requests[0], subject: 'Replacement database request', status: 'approved' }],
            tasks: [{ ...hr.tasks[0], title: 'Replacement database task', status: 'completed',
                completedAt: '2026-02-01T23:00:00Z', dueDate: null }],
        };
        await clearApplicationTables(migration, context);
        await employees.insert(migration, context);
        await hr.insert(migration, context, replacement);
        expectSuccess(await post(), { route: 'SQL', hr: [
            { operation: 'LEAVE_BALANCE', status: 'SUCCESS', data: {
                employeeId: employees.employees.active.id, year: 2026, entitledDays: 28.5, usedDays: 12.5, remainingDays: 16,
            } },
            { operation: 'HR_REQUESTS', status: 'SUCCESS', data: [{ id: replacement.requests[0].id, subject: replacement.requests[0].subject, status: 'approved' }] },
            { operation: 'ONBOARDING_TASKS', status: 'SUCCESS', data: [{ id: replacement.tasks[0].id,
                employeeId: employees.employees.active.id, title: replacement.tasks[0].title, status: 'completed', dueDate: null }] },
        ] });
        expect(external.state.calls.map(call => call.kind)).toEqual(['routing', 'routing']);
    });

    test('uses the authenticated employee even when the question asks for another employee', async () => {
        route();
        const question = `Show HR data for employee ${employees.employees.active.id}`;
        expectSuccess(await post({ question }, tokens.other), { route: 'SQL', hr: results(employees.employees.other.id) }, question);
        expectRoutingOnly(question);
    });

    test.each(['hr', 'admin'])('does not let the %s role read another employee through chat', async name => {
        route();
        expectSuccess(await post(undefined, tokens[name]), { route: 'SQL', hr: [
            { operation: 'LEAVE_BALANCE', status: 'NOT_FOUND', year: 2026 },
            { operation: 'HR_REQUESTS', status: 'SUCCESS', data: [] },
            { operation: 'ONBOARDING_TASKS', status: 'SUCCESS', data: [] },
        ] });
        expectRoutingOnly();
    });

    test('preserves NOT_FOUND for a missing year and continues the other operations', async () => {
        const operations = [{ operation: 'LEAVE_BALANCE', year: 2029 }, ...OPERATIONS.slice(1)];
        route(operations);
        expectSuccess(await post(), { route: 'SQL', hr: results(undefined, operations) });
        expectRoutingOnly();
    });

    test('returns empty lists and NOT_FOUND when no owned HR records exist', async () => {
        await clearApplicationTables(migration, context);
        await employees.insert(migration, context);
        await hr.insert(migration, context, { requests: [hr.requests[3]], balances: [hr.balances[5]], tasks: [hr.tasks[5]] });
        route();
        expectSuccess(await post(), { route: 'SQL', hr: [
            { operation: 'LEAVE_BALANCE', status: 'NOT_FOUND', year: 2026 },
            { operation: 'HR_REQUESTS', status: 'SUCCESS', data: [] },
            { operation: 'ONBOARDING_TASKS', status: 'SUCCESS', data: [] },
        ] });
        expectRoutingOnly();
    });

    test('returns a validated clarification without accessing external retrieval', async () => {
        external.state.decision = { route: 'CLARIFICATION', question: '  Which year?  ' };
        expectSuccess(await post(), { route: 'CLARIFICATION', question: 'Which year?' });
        expectRoutingOnly();
    });

    test.each(['DOCUMENTS', 'HYBRID'])('supports %s with no available documents', async routeName => {
        external.state.decision = routeName === 'HYBRID' ? { route: routeName, operations: OPERATIONS } : { route: routeName };
        expectSuccess(await post(), { route: routeName, documents: INSUFFICIENT,
            ...(routeName === 'HYBRID' ? { hr: results() } : {}) });
        expectRoutingOnly();
    });

    test.each(['  What is my HR information? \n', '\tWhat is my HR information?\r\n'])(
        'normalizes surrounding whitespace before routing and responding: %j', async question => {
            route();
            expectSuccess(await post({ question }), { route: 'SQL', hr: results() });
            expectRoutingOnly();
        },
    );

    test.each(['a'.repeat(4000), '😀'.repeat(2000)])('accepts exactly 4000 UTF-16 code units (%#)', async question => {
        route();
        expectSuccess(await post({ question: `  ${question}  ` }), { route: 'SQL', hr: results() }, question);
        expectRoutingOnly(question);
    });

    const lengthMessage = 'Question must not exceed 4000 UTF-16 code units.';
    test.each([
        ['missing question', {}, ['question should not be empty', 'question must be a string', lengthMessage]],
        ['null question', { question: null }, ['question should not be empty', 'question must be a string', lengthMessage]],
        ['empty question', { question: '' }, ['question should not be empty']],
        ['whitespace question', { question: ' \n\t ' }, ['question should not be empty']],
        ['numeric question', { question: 42 }, ['question must be a string', lengthMessage]],
        ['boolean question', { question: false }, ['question must be a string', lengthMessage]],
        ['array question', { question: ['Question'] }, ['question must be a string', lengthMessage]],
        ['object question', { question: {} }, ['question must be a string', lengthMessage]],
        ['overlong ASCII question', { question: 'a'.repeat(4001) }, [lengthMessage]],
        ['overlong emoji question', { question: '😀'.repeat(2000) + 'a' }, [lengthMessage]],
        ['employee identity override', { question: QUESTION, employeeId: 'another-employee' }, ['property employeeId should not exist']],
    ])('rejects %s before external routing', async (_name, body, messages) => {
        const response = await post(body);
        expect(response.status).toBe(400);
        expect(Array.isArray(response.body.message)).toBe(true);
        expectBody({ ...response.body, message: response.body.message.toSorted() }, {
            statusCode: 400, error: 'Bad Request', message: messages.toSorted(),
        });
        expect(external.state.calls).toEqual([]);
    });

    test.each(['missing', 'invalid', 'expired'])('returns 401 for a %s JWT before external routing', async kind => {
        const token = kind === 'missing' ? null : kind === 'invalid' ? 'invalid-token'
            : await app.get(JwtService).signAsync({ sub: employees.employees.active.id }, { expiresIn: -1 });
        const response = await post(undefined, token);
        expect(response.status).toBe(401);
        expectBody(response.body, { message: 'Unauthorized', statusCode: 401 });
        expect(external.state.calls).toEqual([]);
    });

    test.each([
        ['external transport failure', undefined],
        ['malformed JSON', '{invalid-json'],
        ['unsupported operation', { route: 'SQL', operations: [{ operation: 'DELETE_EMPLOYEE' }] }],
        ['duplicate operation', { route: 'SQL', operations: [OPERATIONS[1], OPERATIONS[1]] }],
        ['identity in model output', { route: 'SQL', operations: [{ ...OPERATIONS[1], employeeId: 'another-employee' }] }],
        ['out-of-range year', { route: 'SQL', operations: [{ operation: 'LEAVE_BALANCE', year: 1999 }] }],
    ])('returns 503 for %s without executing HR operations', async (_name, decision) => {
        external.state.decision = decision;
        const response = await post();
        expect(response.status).toBe(503);
        expectBody(response.body, { statusCode: 503, error: 'Service Unavailable',
            message: 'Не удалось определить способ обработки вопроса. Попробуйте позже.' });
        expectRoutingOnly();
    });

    function prepareDocumentSearch() {
        external.state.points = [{ id: document.chunkId, score: 0.9, payload: {
            documentId: document.id, generationId: document.generationId, chunkId: document.chunkId,
            title: 'Untrusted vector title', text: 'The policy allows annual leave.', pageNumber: 1, chunkIndex: 0,
        } }];
        external.state.answer = { answer: 'The policy allows annual leave [S1].', insufficientInformation: false, sourceIds: ['S1'] };
    }

    test('uses real document access checks and exposes only the supported source contract', async () => {
        await document.insert(migration, context);
        prepareDocumentSearch();
        external.state.decision = { route: 'DOCUMENTS' };
        expectSuccess(await post(), { route: 'DOCUMENTS', documents: { status: 'SUCCESS', data: {
            answer: external.state.answer.answer, insufficientInformation: false, sources: [{ sourceId: 'S1',
                documentId: document.id, generationId: document.generationId, chunkId: document.chunkId,
                title: document.title, pageNumber: 1 }],
        } } });
        expect(external.state.calls.map(call => call.kind)).toEqual(['routing', 'embedding', 'vector', 'generation']);
        const vector = external.state.calls.find(call => call.kind === 'vector');
        expectBody(vector.input.filter, { should: [{ must: [
            { key: 'documentId', match: { value: document.id } },
            { key: 'generationId', match: { value: document.generationId } },
        ] }] });
        expectBody(external.state.calls.at(-1).input, { question: QUESTION, evidence: [{ sourceId: 'S1',
            documentId: document.id, chunkId: document.chunkId, title: document.title,
            pageNumber: 1, text: 'The policy allows annual leave.' }] });
    });

    test('does not search vectors or generate answers for documents forbidden to the authenticated role', async () => {
        await document.insert(migration, context, ['admin']);
        prepareDocumentSearch();
        external.state.decision = { route: 'DOCUMENTS' };
        expectSuccess(await post(), { route: 'DOCUMENTS', documents: INSUFFICIENT });
        expectRoutingOnly();
    });

    test('preserves SQL results when external document generation is unavailable', async () => {
        await document.insert(migration, context);
        prepareDocumentSearch();
        external.state.generationError = true;
        external.state.decision = { route: 'HYBRID', operations: OPERATIONS };
        expectSuccess(await post(), { route: 'HYBRID', documents: { status: 'UNAVAILABLE' }, hr: results() });
        expect(external.state.calls.map(call => call.kind)).toEqual(['routing', 'embedding', 'vector', 'generation']);
    });

    test('propagates an unexpected Qdrant failure as HTTP 500 without inventing document data', async () => {
        await document.insert(migration, context);
        prepareDocumentSearch();
        external.state.vectorError = true;
        external.state.decision = { route: 'DOCUMENTS' };
        const response = await post();
        expect(response.status).toBe(500);
        expectBody(response.body, { statusCode: 500, message: 'Internal server error' });
        expect(external.state.calls.map(call => call.kind)).toEqual(['routing', 'embedding', 'vector']);
    });
});
