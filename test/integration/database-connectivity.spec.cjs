const { createHash } = require('node:crypto');
const { readFile, readdir } = require('node:fs/promises');
const path = require('node:path');
const { readContext, connectVerified } = require('./support/database.cjs');

describe('Disposable PostgreSQL infrastructure', () => {
    let application;
    let migration;

    beforeAll(async () => {
        const context = readContext();
        application = await connectVerified(context, 'application');
        migration = await connectVerified(context, 'migration');
    });

    afterAll(async () => {
        try { await application?.end(); }
        finally { await migration?.end(); }
    });

    test('does not inherit application or PostgreSQL environment settings', () => {
        const inherited = Object.keys(process.env).filter(key => /^(DB_|PG|GEMINI_|QDRANT_|JWT_|NODE_OPTIONS$)/.test(key));
        expect(inherited).toEqual([]);
    });

    test('applies every existing migration with its original checksum', async () => {
        const directory = path.join(__dirname, '../../src/database/migrations');
        const files = (await readdir(directory)).filter(name => /^\d+_[a-z0-9_]+\.sql$/i.test(name)).sort();
        const expected = await Promise.all(files.map(async filename => {
            const sql = (await readFile(path.join(directory, filename), 'utf8')).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
            return { filename, checksum: createHash('sha256').update(sql).digest('hex') };
        }));
        const { rows } = await migration.query('SELECT filename, checksum FROM public.schema_migrations ORDER BY filename');
        expect(rows).toEqual(expected);
        expect(rows.length).toBeGreaterThan(0);
    });

    test('connects as a read-only application role without loading seed data', async () => {
        for (const table of ['employees', 'hr_requests', 'leave_balances', 'onboarding_tasks', 'documents']) {
            const { rows: [row] } = await application.query(`SELECT count(*)::int AS count FROM public.${table}`);
            expect(row.count).toBe(0);
            const { rows: [privileges] } = await application.query(`
                SELECT has_table_privilege(current_user, $1, 'SELECT') AS readable,
                       has_table_privilege(current_user, $1, 'INSERT,UPDATE,DELETE,TRUNCATE') AS writable
            `, [`public.${table}`]);
            expect(privileges).toEqual({ readable: true, writable: false });
        }
        await expect(application.query('SELECT * FROM public.schema_migrations')).rejects.toMatchObject({ code: '42501' });
        await expect(application.query('CREATE TABLE public.forbidden_test_table (id integer)')).rejects.toMatchObject({ code: '42501' });
    });

    test('uses a separate migration owner for all application tables', async () => {
        const { rows } = await migration.query(`
            SELECT tablename, tableowner FROM pg_tables
            WHERE schemaname = 'public' AND tablename <> 'integration_test_identity'
            ORDER BY tablename
        `);
        expect(rows.map(row => row.tablename)).toEqual([
            'documents', 'employees', 'hr_requests', 'leave_balances', 'onboarding_tasks', 'schema_migrations',
        ]);
        expect(rows.every(row => row.tableowner === 'integration_migrator')).toBe(true);
    });
});
