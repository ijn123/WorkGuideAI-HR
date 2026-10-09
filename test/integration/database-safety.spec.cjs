const { randomBytes, randomUUID } = require('node:crypto');
const { assertLocalDockerEndpoint, connectionConfig, assertDatabaseIdentity, clearApplicationTables, ROLES } = require('./support/database.cjs');

function context() {
    const runId = randomUUID();
    const secret = () => randomBytes(32).toString('hex');
    return {
        runId, database: `workguide_integration_${runId.replaceAll('-', '')}`,
        host: '127.0.0.1', port: 54321, containerId: secret(), marker: secret(),
        application: { user: ROLES.application, password: secret() },
        migration: { user: ROLES.migration, password: secret() },
    };
}

describe('Integration database safety', () => {
    test.each(['tcp://127.0.0.1:2375', 'ssh://remote.example.invalid', '', undefined])(
        'rejects a non-local Docker endpoint (%s)', endpoint => {
            expect(() => assertLocalDockerEndpoint(endpoint)).toThrow('local Docker Unix socket');
        },
    );

    test('accepts a local Docker Unix socket', () => {
        expect(() => assertLocalDockerEndpoint('unix:///var/run/docker.sock')).not.toThrow();
    });

    test.each([
        ['remote host', { host: 'database.example.invalid' }],
        ['ambiguous hostname', { host: 'localhost' }],
        ['development database', { database: 'workguide_ai' }],
        ['production database', { database: 'defaultdb' }],
        ['unrelated test database', { database: 'workguide_integration_other' }],
        ['invalid port', { port: 0 }],
        ['missing container identity', { containerId: undefined }],
        ['missing marker', { marker: undefined }],
        ['administrative application role', { application: { user: 'postgres' } }],
        ['shared migration role', { migration: { user: ROLES.application } }],
    ])('rejects %s before connecting', (_name, change) => {
        expect(() => connectionConfig({ ...context(), ...change }, 'application')).toThrow('Unsafe integration database context');
    });

    test('rejects unknown roles before connecting', () => {
        expect(() => connectionConfig(context(), 'administrator')).toThrow('Unknown integration database role');
    });

    test.each(['database', 'username', 'schema', 'port', 'marker', 'rolsuper', 'rolcreatedb', 'rolcreaterole'])(
        'rejects a server identity mismatch in %s', async field => {
            const value = context();
            const row = {
                database: value.database, username: ROLES.application, schema: 'public', port: 5432,
                marker: value.marker, rolsuper: false, rolcreatedb: false, rolcreaterole: false,
            };
            row[field] = typeof row[field] === 'boolean' ? true : 'unexpected';
            await expect(assertDatabaseIdentity({ query: async () => ({ rows: [row] }) }, value, 'application'))
                .rejects.toThrow('Integration database identity mismatch');
        },
    );

    test('does not expose database errors in identity diagnostics', async () => {
        await expect(assertDatabaseIdentity({ query: async () => { throw new Error('sensitive diagnostic'); } }, context(), 'application'))
            .rejects.toThrow(/^Integration database identity could not be verified\.$/);
    });

    test('refuses cleanup before mutation when the database identity is unverified', async () => {
        const queries = [];
        const client = { query: async sql => { queries.push(sql); return { rows: [] }; } };
        await expect(clearApplicationTables(client, context())).rejects.toThrow('Integration database identity mismatch');
        expect(queries.length).toBe(1);
        expect(queries.some(sql => /TRUNCATE|DELETE|UPDATE|INSERT/.test(sql))).toBe(false);
    });
});
