const { Client } = require('pg');

const ROLES = Object.freeze({ application: 'integration_app', migration: 'integration_migrator' });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HEX = /^[0-9a-f]{64}$/;

function assertLocalDockerEndpoint(endpoint) {
    if (typeof endpoint !== 'string' || !/^unix:\/\/\/[^\r\n]+$/.test(endpoint)) {
        throw new Error('Integration tests require a local Docker Unix socket.');
    }
}

function validateContext(context) {
    if (!context || !UUID.test(context.runId)
        || context.database !== `workguide_integration_${context.runId.replaceAll('-', '')}`
        || context.host !== '127.0.0.1'
        || !Number.isInteger(context.port) || context.port < 1 || context.port > 65535
        || !HEX.test(context.containerId) || !HEX.test(context.marker)
        || Object.entries(ROLES).some(([role, user]) =>
            context[role]?.user !== user || !HEX.test(context[role]?.password))) {
        throw new Error('Unsafe integration database context. Use the disposable database runner.');
    }
    return context;
}

function readContext() {
    let context;
    try {
        context = JSON.parse(process.env.INTEGRATION_TEST_CONTEXT);
    } catch {
        throw new Error('Missing integration database context. Use npm run test:integration.');
    }
    return validateContext(context);
}

function connectionConfig(context, role) {
    validateContext(context);
    if (!Object.hasOwn(ROLES, role)) throw new Error('Unknown integration database role.');
    return {
        host: context.host,
        port: context.port,
        database: context.database,
        user: context[role].user,
        password: context[role].password,
        ssl: false,
        connectionTimeoutMillis: 5000,
        query_timeout: 10000,
        options: '-c search_path=public -c statement_timeout=10000 -c lock_timeout=3000',
        application_name: 'workguide-integration-tests',
    };
}

async function assertDatabaseIdentity(client, context, role) {
    connectionConfig(context, role);
    let row;
    try {
        ({ rows: [row] } = await client.query(`
            SELECT current_database() AS database, current_user AS username,
                   current_schema() AS schema, inet_server_port() AS port,
                   r.rolsuper, r.rolcreatedb, r.rolcreaterole,
                   (SELECT marker FROM public.integration_test_identity WHERE singleton) AS marker
            FROM pg_roles r WHERE rolname = current_user
        `));
    } catch {
        throw new Error('Integration database identity could not be verified.');
    }
    if (!row || row.database !== context.database || row.username !== ROLES[role]
        || row.schema !== 'public' || row.port !== 5432 || row.marker !== context.marker
        || row.rolsuper || row.rolcreatedb || row.rolcreaterole) {
        throw new Error('Integration database identity mismatch.');
    }
}

async function connectVerified(context, role) {
    const client = new Client(connectionConfig(context, role));
    try {
        await client.connect();
        await assertDatabaseIdentity(client, context, role);
        return client;
    } catch {
        await client.end().catch(() => {});
        throw new Error('Could not open a verified integration database connection.');
    }
}

async function assertApplicationTablesEmpty(client, context) {
    await assertDatabaseIdentity(client, context, 'migration');
    const { rows: [row] } = await client.query(`
        SELECT (SELECT count(*) FROM public.employees)
             + (SELECT count(*) FROM public.hr_requests)
             + (SELECT count(*) FROM public.leave_balances)
             + (SELECT count(*) FROM public.onboarding_tasks)
             + (SELECT count(*) FROM public.documents) AS count
    `);
    if (Number(row.count) !== 0) throw new Error('Integration fixture cleanup left application data behind.');
}

async function clearApplicationTables(client, context) {
    // Recheck identity before every mutation, not only when opening the connection.
    await assertDatabaseIdentity(client, context, 'migration');
    try {
        await client.query(`
            TRUNCATE public.hr_requests, public.leave_balances, public.onboarding_tasks,
                     public.documents, public.employees
        `);
        await assertApplicationTablesEmpty(client, context);
    } catch {
        throw new Error('Integration fixture cleanup failed.');
    }
}

module.exports = {
    ROLES, assertLocalDockerEndpoint, validateContext, readContext, connectionConfig,
    assertDatabaseIdentity, connectVerified, clearApplicationTables, assertApplicationTablesEmpty,
};
