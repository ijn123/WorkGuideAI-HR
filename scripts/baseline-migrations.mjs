import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import pg from 'pg';

const { Client } = pg;

// Только миграции, соответствующие проверенной схеме.
// Новые миграции в этот список не добавляем.
const filenames = [
    '001_create_employees.sql',
    '002_create_hr_requests.sql',
    '003_create_leave_balances.sql',
    '004_create_onboarding_tasks.sql',
    '005_add_employee_role_and_status.sql',
    '006_validate_leave_day_increments.sql',
    '007_extend_onboarding_tasks.sql',
    '008_validate_onboarding_completion.sql',
    '009_create_documents.sql',
];

function required(name) {
    const value = process.env[name];

    if (!value?.trim()) {
        throw new Error(`Не задана переменная ${name}`);
    }

    return value;
}

async function main() {
    if (!process.argv.includes('--confirm-reviewed-schema')) {
        throw new Error(
            'Сначала проверьте соответствие схемы миграциям 001–009. ' +
            'Для подтверждения нужен --confirm-reviewed-schema',
        );
    }

    const directory = new URL('../src/database/migrations/', import.meta.url);
    const migrations = [];

    for (const filename of filenames) {
        const sql = (await readFile(new URL(filename, directory), 'utf8'))
            .replace(/^\uFEFF/, '')
            .replace(/\r\n/g, '\n');

        migrations.push({
            filename,
            checksum: createHash('sha256').update(sql).digest('hex'),
        });
    }

    const port = Number(required('DB_PORT'));

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('Некорректный DB_PORT');
    }

    const client = new Client({
        host: required('DB_HOST'),
        port,
        database: required('DB_NAME'),
        user: required('DB_MIGRATION_USER'),
        password: required('DB_MIGRATION_PASSWORD'),
        connectionTimeoutMillis: 5000,
    });

    await client.connect();

    try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(617204, 1)');

        await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        filename TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

        const existing = await client.query(
            'SELECT filename FROM public.schema_migrations LIMIT 1',
        );

        if (existing.rowCount !== 0) {
            throw new Error(
                'История миграций уже заполнена. Регистрация отменена.',
            );
        }

        for (const migration of migrations) {
            await client.query(
                `
          INSERT INTO public.schema_migrations (filename, checksum)
          VALUES ($1, $2)
        `,
                [migration.filename, migration.checksum],
            );
        }

        await client.query('COMMIT');
        console.log('Зарегистрировано ранее выполненных миграций: 9');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error('Ошибка регистрации:', error.message);
    process.exitCode = 1;
});