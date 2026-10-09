import { execFile } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import database from '../test/integration/support/database.cjs';

const execute = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const runId = randomUUID();
const name = `workguide-integration-${runId}`;
const label = 'workguide.integration.run';
const secret = () => randomBytes(32).toString('hex');
const administratorPassword = secret();
const context = {
    runId,
    database: `workguide_integration_${runId.replaceAll('-', '')}`,
    host: '127.0.0.1',
    marker: secret(),
    application: { user: database.ROLES.application, password: secret() },
    migration: { user: database.ROLES.migration, password: secret() },
};
const abort = new AbortController();
let receivedSignal;
let stage = 'Docker preparation';
let administrator;
let creationAttempted = false;

function signalHandler(signal) {
    receivedSignal = signal;
    abort.abort();
}
const onInterrupt = () => signalHandler('SIGINT');
const onTerminate = () => signalHandler('SIGTERM');
process.on('SIGINT', onInterrupt);
process.on('SIGTERM', onTerminate);

// Never inherit DB_*, PG*, NODE_OPTIONS, or application secrets in children.
function environment(keys) {
    return Object.fromEntries(keys.filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
}
const childEnvironment = environment(['PATH', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot']);
const dockerEnvironment = {
    ...childEnvironment,
    ...environment(['HOME', 'DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_CONFIG', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']),
};

function run(command, args, options = {}) {
    return execute(command, args, {
        cwd: root,
        env: childEnvironment,
        timeout: 120000,
        maxBuffer: 5 * 1024 * 1024,
        signal: abort.signal,
        ...options,
    });
}

function docker(args, options = {}) {
    return run('docker', args, { env: dockerEnvironment, ...options });
}

function redact(output = '') {
    for (const value of [administratorPassword, context.application.password, context.migration.password, context.marker]) {
        output = output.replaceAll(value, '[REDACTED]');
    }
    return output;
}

async function verifyContainer() {
    const format = `{{.Id}}|{{index .Config.Labels "${label}"}}|{{.State.Running}}|{{json (index .NetworkSettings.Ports "5432/tcp")}}`;
    const { stdout } = await docker(['inspect', '--type', 'container', '--format', format, name]);
    const [id, actualRunId, running, bindings] = stdout.trim().split('|');
    const ports = JSON.parse(bindings);
    if (!/^[0-9a-f]{64}$/.test(id) || actualRunId !== runId || running !== 'true'
        || !Array.isArray(ports) || ports.length !== 1 || ports[0].HostIp !== '127.0.0.1') {
        throw new Error('Disposable container identity mismatch.');
    }
    if (context.containerId && (context.containerId !== id || context.port !== Number(ports[0].HostPort))) {
        throw new Error('Disposable container identity changed.');
    }
    context.containerId = id;
    context.port = Number(ports[0].HostPort);
    database.validateContext(context);
}

async function waitForPostgres() {
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
        try {
            // initdb's temporary server only listens on a Unix socket, not TCP.
            await docker(['exec', context.containerId, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', context.database], { timeout: 5000 });
            return;
        } catch {
            abort.signal.throwIfAborted();
            await delay(250, undefined, { signal: abort.signal });
        }
    }
    throw new Error('Disposable PostgreSQL did not become ready.');
}

async function prepareDatabase() {
    stage = 'administrator connection';
    administrator = new pg.Client({
        host: context.host, port: context.port, database: context.database,
        user: 'postgres', password: administratorPassword, ssl: false,
        connectionTimeoutMillis: 5000, query_timeout: 10000,
        options: '-c search_path=public -c statement_timeout=10000 -c lock_timeout=3000',
    });
    await administrator.connect();
    const { rows: [identity] } = await administrator.query('SELECT current_database() AS database, current_user AS username');
    if (identity.database !== context.database || identity.username !== 'postgres') {
        throw new Error('Disposable administrator identity mismatch.');
    }
    const { rows } = await administrator.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    if (rows.length !== 0) throw new Error('Disposable database is not empty.');

    stage = 'isolated role provisioning';
    // Identifiers are fixed; passwords and database names use generated safe alphabets.
    for (const role of ['migration', 'application']) {
        await administrator.query(`CREATE ROLE ${context[role].user} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD '${context[role].password}'`);
    }
    await administrator.query(`REVOKE ALL ON DATABASE ${context.database} FROM PUBLIC`);
    await administrator.query(`GRANT CONNECT ON DATABASE ${context.database} TO integration_migrator, integration_app`);
    await administrator.query('REVOKE ALL ON SCHEMA public FROM PUBLIC');
    await administrator.query('GRANT USAGE, CREATE ON SCHEMA public TO integration_migrator');
    await administrator.query('GRANT USAGE ON SCHEMA public TO integration_app');
    await administrator.query(`
        CREATE TABLE public.integration_test_identity (
            singleton boolean PRIMARY KEY CHECK (singleton), marker text NOT NULL
        )
    `);
    await administrator.query('INSERT INTO public.integration_test_identity VALUES (true, $1)', [context.marker]);
    await administrator.query('GRANT SELECT ON public.integration_test_identity TO integration_migrator, integration_app');
}

async function migrate() {
    await verifyContainer();
    const client = await database.connectVerified(context, 'migration');
    await client.end();
    // Run the existing script directly: the npm migration command loads .env.
    await run(process.execPath, ['scripts/migrate.mjs'], {
        env: {
            ...childEnvironment,
            DB_HOST: context.host, DB_PORT: String(context.port), DB_NAME: context.database, DB_SSL: 'false',
            DB_MIGRATION_USER: context.migration.user, DB_MIGRATION_PASSWORD: context.migration.password,
        },
    });
    await administrator.query(`
        GRANT SELECT ON public.employees, public.hr_requests, public.leave_balances,
                        public.onboarding_tasks, public.documents TO integration_app
    `);
    const { rows: [row] } = await administrator.query('SELECT count(*)::int AS count FROM public.schema_migrations');
    console.log(`Applied ${row.count} migrations to disposable PostgreSQL.`);
}

async function cleanup() {
    try {
        await administrator?.end();
    } finally {
        if (creationAttempted) {
            // Match both the unique name and ownership label, including partial create failures.
            const { stdout } = await docker([
                'container', 'ls', '--all', '--no-trunc', '--filter', `name=^/${name}$`,
                '--filter', `label=${label}=${runId}`, '--format', '{{.ID}}',
            ], { signal: undefined, timeout: 15000 });
            const ids = stdout.trim().split(/\s+/).filter(Boolean);
            if (ids.length > 1 || ids.some(id => !/^[0-9a-f]{64}$/.test(id))
                || (context.containerId && ids.some(id => id !== context.containerId))) {
                throw new Error('Refusing cleanup of an unexpected container.');
            }
            for (const id of ids) await docker(['rm', '--force', '--volumes', id], { signal: undefined, timeout: 30000 });
            const remaining = await docker([
                'container', 'ls', '--all', '--filter', `label=${label}=${runId}`, '--format', '{{.ID}}',
            ], { signal: undefined, timeout: 15000 });
            if (remaining.stdout.trim()) throw new Error('Disposable container cleanup is incomplete.');
            console.log(`Disposable PostgreSQL container removed: ${name}`);
        }
    }
}

try {
    stage = 'Node.js 24.9+ prerequisite';
    const [major, minor] = process.versions.node.split('.').map(Number);
    if (major < 24 || (major === 24 && minor < 9)) throw new Error('Node.js 24.9+ is required.');
    stage = 'application build';
    await run(process.execPath, ['node_modules/@nestjs/cli/bin/nest.js', 'build']);
    stage = 'Docker preparation';
    if (dockerEnvironment.DOCKER_HOST) database.assertLocalDockerEndpoint(dockerEnvironment.DOCKER_HOST);
    const endpoint = await docker(['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}']);
    database.assertLocalDockerEndpoint(endpoint.stdout.trim());
    await docker(['info', '--format', '{{.ServerVersion}}'], { timeout: 15000 });
    // Pull before attempting creation so a failed download cannot leave a container.
    await docker(['pull', 'postgres:17']);
    creationAttempted = true;
    await docker([
        'create', '--name', name, '--label', `${label}=${runId}`,
        '--publish', '127.0.0.1::5432', '--tmpfs', '/var/lib/postgresql/data:rw',
        '--env', 'POSTGRES_PASSWORD', '--env', `POSTGRES_DB=${context.database}`,
        '--env', 'POSTGRES_HOST_AUTH_METHOD=scram-sha-256', 'postgres:17',
    ], { env: { ...dockerEnvironment, POSTGRES_PASSWORD: administratorPassword }, signal: undefined });
    await docker(['start', name]);
    await verifyContainer();
    console.log(`Disposable PostgreSQL container started: ${name}`);
    stage = 'PostgreSQL initialization';
    await waitForPostgres();
    await prepareDatabase();
    stage = 'migrations';
    await migrate();
    stage = 'integration tests';
    await verifyContainer();
    try {
        const result = await run(process.execPath, [
            '--experimental-vm-modules', 'node_modules/jest/bin/jest.js', '--config', 'test/jest-integration.config.cjs',
            ...process.argv.slice(2), '--runInBand',
        ], { env: { ...childEnvironment, INTEGRATION_TEST_CONTEXT: JSON.stringify(context) }, timeout: 300000 });
        process.stdout.write(redact(result.stdout));
        process.stderr.write(redact(result.stderr));
        const client = await database.connectVerified(context, 'migration');
        try { await database.assertApplicationTablesEmpty(client, context); }
        finally { await client.end(); }
        console.log('Fixture cleanup verified: all application tables are empty.');
    } catch (error) {
        process.stdout.write(redact(error.stdout));
        process.stderr.write(redact(error.stderr));
        throw error;
    }
} catch (error) {
    const code = typeof error.code === 'string' && /^[A-Z0-9_]{1,32}$/.test(error.code) ? ` (${error.code})` : '';
    console.error(`Integration infrastructure failed during ${stage}${code}. Raw child/database diagnostics are suppressed to protect credentials.`);
    process.exitCode = 1;
} finally {
    try {
        await cleanup();
    } catch {
        console.error(`Disposable container cleanup failed. Remove only the container named ${name} after checking its ${label} label.`);
        process.exitCode = 1;
    }
    process.off('SIGINT', onInterrupt);
    process.off('SIGTERM', onTerminate);
    if (receivedSignal) process.exitCode = receivedSignal === 'SIGINT' ? 130 : 143;
}
