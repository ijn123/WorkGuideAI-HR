import { pathToFileURL } from 'node:url';
import pg from 'pg';

const employees = [
    ['10000000-0000-4000-8000-000000000002', 'Max', 'Weber', 'max.weber@example.com', 'IT', 'employee', 'active'],
    ['10000000-0000-4000-8000-000000000001', 'Anna', 'Becker', 'anna.becker@example.com', 'HR', 'hr', 'active'],
];
const fields = ['id', 'first_name', 'last_name', 'work_email', 'department', 'role', 'employment_status'];

export class DemoEmployeeError extends Error {}

export function databaseConfig(env = process.env) {
    function required(name) {
        if (!env[name]?.trim()) throw new DemoEmployeeError(`${name} is required.`);
        return env[name];
    }
    const port = Number(required('DB_PORT'));
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new DemoEmployeeError('DB_PORT must be an integer between 1 and 65535.');
    }
    const ssl = (env.DB_SSL ?? 'false').toLowerCase();
    if (ssl !== 'true' && ssl !== 'false') {
        throw new DemoEmployeeError('DB_SSL must be true or false.');
    }
    return {
        host: required('DB_HOST'),
        port,
        database: required('DB_NAME'),
        user: required('DB_MIGRATION_USER'),
        password: required('DB_MIGRATION_PASSWORD'),
        connectionTimeoutMillis: 5000,
        ssl: ssl === 'true'
            ? { rejectUnauthorized: true, ...(env.DB_SSL_CA_CERT?.trim() ? { ca: env.DB_SSL_CA_CERT } : {}) }
            : false,
    };
}

export async function createDemoEmployees(client) {
    await client.query('BEGIN');
    try {
        await client.query("SET LOCAL lock_timeout = '5s'");
        await client.query("SET LOCAL statement_timeout = '10s'");
        await client.query("SET LOCAL idle_in_transaction_session_timeout = '10s'");
        // Serialize writers, including callers that do not use this script.
        // Reads remain available; no profile or credential updates are performed.
        await client.query('LOCK TABLE public.employees IN SHARE ROW EXCLUSIVE MODE');
        let created = 0;
        for (const employee of employees) {
            const { rows } = await client.query(
                `SELECT id, first_name, last_name, work_email, department, role, employment_status
                 FROM public.employees WHERE id = $1 OR lower(work_email) = $2`,
                [employee[0], employee[3]],
            );
            if (rows.length !== 0) {
                if (rows.length !== 1 || fields.some((field, index) => rows[0][field] !== employee[index])) {
                    throw new DemoEmployeeError('Demo employee identity conflict; no changes committed.');
                }
                continue;
            }
            await client.query(
                `INSERT INTO public.employees
                    (id, first_name, last_name, work_email, department, role, employment_status, password_hash)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)`,
                employee,
            );
            created += 1;
        }
        await client.query('COMMIT');
        return created;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
}

async function main() {
    if (process.argv.length > 2) throw new DemoEmployeeError('Command-line arguments are not supported.');
    const client = new pg.Client(databaseConfig());
    try {
        await client.connect();
        const created = await createDemoEmployees(client);
        console.log(`Demo employees verified; created ${created} records.`);
    } finally {
        await client.end();
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(error => {
        console.error(error instanceof DemoEmployeeError
            ? error.message
            : 'Demo employee creation failed. Check database access and configuration.');
        process.exitCode = 1;
    });
}
