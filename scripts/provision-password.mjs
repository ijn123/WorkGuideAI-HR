import { createRequire } from 'node:module';
import pg from 'pg';
import { z } from 'zod';

const require = createRequire(import.meta.url);
const { PasswordService } = require('../src/auth/password.service.ts');
const { Client } = pg;
const MAX_PASSWORD_BYTES = 1024;

class ProvisioningError extends Error {}

function required(name) {
    const value = process.env[name];

    if (!value?.trim()) {
        throw new ProvisioningError(`${name} is required.`);
    }

    return value;
}

async function main() {
    if (process.argv.length > 2) {
        throw new ProvisioningError(
            'Command-line arguments are not supported. Use provisioning environment variables.',
        );
    }

    const email = required('AUTH_PROVISION_EMAIL').trim().toLowerCase();

    if (!z.string().email().max(254).safeParse(email).success) {
        throw new ProvisioningError('AUTH_PROVISION_EMAIL must be a valid email.');
    }

    const password = process.env.AUTH_PROVISION_PASSWORD;

    if (password === undefined || password.length === 0) {
        throw new ProvisioningError('AUTH_PROVISION_PASSWORD must be non-empty.');
    }

    if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
        throw new ProvisioningError('AUTH_PROVISION_PASSWORD must not exceed 1024 UTF-8 bytes.');
    }

    const overwriteValue = process.env.AUTH_PROVISION_OVERWRITE ?? 'false';

    if (overwriteValue !== 'true' && overwriteValue !== 'false') {
        throw new ProvisioningError('AUTH_PROVISION_OVERWRITE must be true or false.');
    }

    const overwrite = overwriteValue === 'true';
    const port = Number(required('DB_PORT'));

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new ProvisioningError('DB_PORT must be an integer between 1 and 65535.');
    }

    const sslValue = (process.env.DB_SSL ?? 'false').toLowerCase();

    if (sslValue !== 'true' && sslValue !== 'false') {
        throw new ProvisioningError('DB_SSL must be true or false.');
    }

    const caCertificate = process.env.DB_SSL_CA_CERT;
    const client = new Client({
        host: required('DB_HOST'),
        port,
        database: required('DB_NAME'),
        user: required('DB_MIGRATION_USER'),
        password: required('DB_MIGRATION_PASSWORD'),
        connectionTimeoutMillis: 5000,
        ssl: sslValue === 'true'
            ? {
                rejectUnauthorized: true,
                ...(caCertificate?.trim() ? { ca: caCertificate } : {}),
            }
            : false,
    });

    try {
        await client.connect();

        const existing = await client.query(
            `SELECT id, password_hash IS NOT NULL AS has_password
             FROM employees
             WHERE lower(work_email) = $1`,
            [email],
        );
        const employee = existing.rows[0];

        if (!employee) {
            throw new ProvisioningError('Employee not found; no employee was created.');
        }

        if (employee.has_password && !overwrite) {
            throw new ProvisioningError('Employee already has password credentials; overwrite is disabled.');
        }

        const passwordHash = await new PasswordService().hash(password);
        const updated = await client.query(
            `UPDATE employees
             SET password_hash = $1
             WHERE id = $2
               AND ($3::boolean OR password_hash IS NULL)
             RETURNING id`,
            [passwordHash, employee.id, overwrite],
        );

        if (updated.rows.length === 0) {
            const remaining = await client.query(
                'SELECT id FROM employees WHERE id = $1',
                [employee.id],
            );

            if (remaining.rows.length === 0) {
                throw new ProvisioningError('Employee not found; no employee was created.');
            }

            throw new ProvisioningError('Employee already has password credentials; overwrite is disabled.');
        }

        console.log('Password provisioned for the existing employee.');
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error(error instanceof ProvisioningError
        ? error.message
        : 'Password provisioning failed. Check database access and configuration.');
    process.exitCode = 1;
});
