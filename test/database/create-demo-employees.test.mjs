import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { before, after, beforeEach, describe, it } from 'node:test';
import pg from 'pg';
import { databaseConfig, createDemoEmployees } from '../../scripts/create-demo-employees.mjs';

const identities = [
    { id: '10000000-0000-4000-8000-000000000001', first_name: 'Anna', last_name: 'Becker', work_email: 'anna.becker@example.com', department: 'HR', role: 'hr', employment_status: 'active' },
    { id: '10000000-0000-4000-8000-000000000002', first_name: 'Max', last_name: 'Weber', work_email: 'max.weber@example.com', department: 'IT', role: 'employee', employment_status: 'active' },
];

describe('Demo employee configuration (offline)', () => {
    const env = { DB_HOST: '127.0.0.1', DB_PORT: '5432', DB_NAME: 'demo_test', DB_MIGRATION_USER: 'admin', DB_MIGRATION_PASSWORD: randomUUID() };
    it('requires every connection field and never falls back to runtime credentials', () => {
        for (const name of Object.keys(env)) {
            assert.throws(() => databaseConfig({ ...env, [name]: '', DB_USER: 'reader', DB_PASSWORD: randomUUID() }), new RegExp(name));
        }
    });
    it('validates port and SSL and keeps TLS certificate verification enabled', () => {
        for (const port of ['0', '65536', 'abc', '1.5']) assert.throws(() => databaseConfig({ ...env, DB_PORT: port }));
        assert.throws(() => databaseConfig({ ...env, DB_SSL: 'invalid' }));
        assert.equal(databaseConfig(env).ssl, false);
        assert.deepEqual(databaseConfig({ ...env, DB_SSL: 'true' }).ssl, { rejectUnauthorized: true });
        assert.deepEqual(databaseConfig({ ...env, DB_SSL: 'true', DB_SSL_CA_CERT: 'test CA placeholder' }).ssl, { rejectUnauthorized: true, ca: 'test CA placeholder' });
    });
    it('fails before connecting when configuration is missing, without leaking environment values', () => {
        const result = spawnSync(process.execPath, ['scripts/create-demo-employees.mjs'], {
            env: { PATH: process.env.PATH }, encoding: 'utf8',
        });
        assert.equal(result.status, 1);
        assert.equal(result.stdout, '');
        assert.match(result.stderr, /^DB_PORT is required\.\n$/);
    });
});

// Only use a dedicated disposable local PostgreSQL container, never a project .env.
describe('Demo employees in disposable PostgreSQL', { skip: !process.env.DEMO_TEST_PORT, concurrency: false }, () => {
    let client;
    const config = { host: '127.0.0.1', port: Number(process.env.DEMO_TEST_PORT), database: 'postgres', user: 'postgres', ssl: false };
    async function connect() {
        const connection = new pg.Client(config);
        await connection.connect();
        return connection;
    }
    async function records() {
        return (await client.query('SELECT * FROM public.employees ORDER BY id')).rows;
    }
    before(async () => {
        client = await connect();
        // Refuse to touch a database containing an existing employees table.
        const { rows } = await client.query("SELECT to_regclass('public.employees') AS existing");
        assert.equal(rows[0].existing, null, 'Integration tests require a fresh disposable database');
        for (const file of ['001_create_employees.sql', '005_add_employee_role_and_status.sql', '010_add_employee_password_hash.sql']) {
            await client.query(await readFile(new URL(`../../src/database/migrations/${file}`, import.meta.url), 'utf8'));
        }
        await client.query('CREATE ROLE demo_test_reader NOLOGIN');
        await client.query('GRANT USAGE ON SCHEMA public TO demo_test_reader');
        await client.query('GRANT SELECT ON public.employees TO demo_test_reader');
    });
    after(async () => { await client?.end(); });
    beforeEach(async () => { await client.query('TRUNCATE public.employees'); });

    it('creates exactly the two approved identities, with NULL hashes', async () => {
        assert.equal(await createDemoEmployees(client), 2);
        const rows = await records();
        assert.deepEqual(rows.map(({ created_at, password_hash, ...identity }) => identity), identities);
        assert.ok(rows.every(row => row.password_hash === null));
    });
    it('repeated execution preserves profiles, timestamps and existing hashes', async () => {
        await createDemoEmployees(client);
        // An opaque non-credential sentinel checks preservation without generating a password.
        await client.query('UPDATE public.employees SET password_hash = $1', ['opaque-test-hash']);
        const beforeRows = await records();
        assert.equal(await createDemoEmployees(client), 0);
        assert.deepEqual(await records(), beforeRows);
    });
    it('creates only a missing approved employee', async () => {
        await createDemoEmployees(client);
        await client.query('DELETE FROM public.employees WHERE id = $1', [identities[0].id]);
        assert.equal(await createDemoEmployees(client), 1);
        assert.equal((await records()).length, 2);
    });
    for (const [field, value] of [
        ['first_name', 'Unexpected'], ['last_name', 'Unexpected'], ['department', 'Unexpected'],
        ['role', 'admin'], ['employment_status', 'inactive'],
        ['work_email', 'other@example.com'], ['id', '20000000-0000-4000-8000-000000000001'],
        ['work_email', 'ANNA.BECKER@example.com'],
    ]) {
        it(`rejects unexpected ${field} and rolls back the earlier Max insertion (${value})`, async () => {
            await createDemoEmployees(client);
            await client.query('DELETE FROM public.employees WHERE id = $1', [identities[1].id]);
            // Column names come exclusively from the fixed test cases above.
            await client.query(`UPDATE public.employees SET ${field} = $1`, [value]);
            const beforeRows = await records();
            await assert.rejects(createDemoEmployees(client), /identity conflict/);
            assert.deepEqual(await records(), beforeRows);
        });
    }
    it('rejects a split UUID/email conflict without changing either record', async () => {
        await createDemoEmployees(client);
        await client.query('UPDATE public.employees SET work_email = $1 WHERE id = $2', ['other@example.com', identities[0].id]);
        await client.query(`INSERT INTO public.employees (first_name, last_name, work_email, department) VALUES ($1, $2, $3, $4)`, ['Other', 'Person', identities[0].work_email, 'IT']);
        const beforeRows = await records();
        await assert.rejects(createDemoEmployees(client), /identity conflict/);
        assert.deepEqual(await records(), beforeRows);
    });
    it('rolls back both inserts on a database error', async () => {
        await client.query("ALTER TABLE public.employees ADD CONSTRAINT test_reject_anna CHECK (first_name <> 'Anna')");
        try {
            await assert.rejects(createDemoEmployees(client), error => error.code === '23514');
            assert.deepEqual(await records(), []);
        } finally {
            await client.query('ALTER TABLE public.employees DROP CONSTRAINT test_reject_anna');
        }
    });
    it('serializes concurrent executions without duplicates', async () => {
        const other = await connect();
        try {
            const results = await Promise.all([createDemoEmployees(client), createDemoEmployees(other)]);
            assert.deepEqual(results.sort(), [0, 2]);
            assert.equal((await records()).length, 2);
        } finally { await other.end(); }
    });
    it('rejects read-only database permissions with no writes', async () => {
        const reader = await connect();
        try {
            await reader.query('SET ROLE demo_test_reader');
            await assert.rejects(createDemoEmployees(reader), error => error.code === '42501');
            assert.deepEqual(await records(), []);
        } finally { await reader.end(); }
    });

    it('terminates an idle administrative transaction and releases its table lock', { timeout: 20000 }, async () => {
        const holder = await connect();
        const contender = await connect();
        let timeoutHandle;
        let sawLock = false;
        let idleTimeout;
        // Register before idling: pg emits a backend termination as a client error.
        const terminated = new Promise(resolve => {
            holder.on('error', error => {
                if (error.code === '25P03') resolve(error);
            });
        });
        const originalQuery = holder.query.bind(holder);
        holder.query = async (...args) => {
            const result = await originalQuery(...args);
            if (args[0] === 'LOCK TABLE public.employees IN SHARE ROW EXCLUSIVE MODE') {
                sawLock = true;
                idleTimeout = (await originalQuery('SHOW idle_in_transaction_session_timeout')).rows[0].idle_in_transaction_session_timeout;
                // Exercise the real script configuration, then pause its next step
                // until PostgreSQL terminates the transaction holding the lock.
                await terminated;
            }
            return result;
        };
        try {
            const operation = createDemoEmployees(holder).then(
                () => ({ succeeded: true }),
                () => ({ succeeded: false }),
            );
            const error = await Promise.race([
                terminated,
                new Promise((_, reject) => {
                    timeoutHandle = setTimeout(() => reject(new Error('Idle transaction was not terminated in time')), 15000);
                }),
            ]);
            assert.equal(error.code, '25P03');
            assert.equal(sawLock, true);
            assert.equal(idleTimeout, '10s');
            assert.deepEqual(await operation, { succeeded: false });
            await contender.query('BEGIN');
            await contender.query("SET LOCAL lock_timeout = '2s'");
            await contender.query("SET LOCAL statement_timeout = '3s'");
            // NOWAIT proves the conflicting lock is no longer held.
            await contender.query('LOCK TABLE public.employees IN ROW EXCLUSIVE MODE NOWAIT');
            await contender.query('ROLLBACK');
            assert.deepEqual(await records(), []);
        } finally {
            clearTimeout(timeoutHandle);
            await holder.end();
            await contender.end();
        }
    });
});
