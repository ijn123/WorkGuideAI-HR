import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import pg from 'pg';

const { Client } = pg;

function required(name) {
    const value = process.env[name];

    if (!value?.trim()) {
        throw new Error(`Не задана переменная ${name}`);
    }

    return value;
}

function checksum(sql) {
    return createHash('sha256').update(sql).digest('hex');
}

function transactionBody(sql, filename) {
    // Наши SQL-файлы уже содержат BEGIN и COMMIT.
    // Транзакцией будет управлять скрипт, чтобы записать
    // результат миграции в историю в той же транзакции.
    const match = sql.match(/^\s*BEGIN\s*;([\s\S]*?)COMMIT\s*;\s*$/i);

    if (!match) {
        throw new Error(
            `${filename}: ожидается файл с BEGIN; в начале и COMMIT; в конце`,
        );
    }

    return match[1];
}

async function main() {
    const port = Number(required('DB_PORT'));

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('DB_PORT должен быть целым числом от 1 до 65535');
    }

    const sslValue = (process.env.DB_SSL ?? 'false').toLowerCase();

    if (sslValue !== 'true' && sslValue !== 'false') {
        throw new Error('DB_SSL должен быть true или false');
    }

    const caCertificate = process.env.DB_SSL_CA_CERT;

    const directory = new URL('../src/database/migrations/', import.meta.url);

    const filenames = (await readdir(directory))
        .filter((name) => /^\d+_[a-z0-9_]+\.sql$/i.test(name))
        .sort();

    const migrations = [];

    for (const filename of filenames) {
        const sql = (await readFile(new URL(filename, directory), 'utf8'))
            .replace(/^\uFEFF/, '')
            .replace(/\r\n/g, '\n');

        migrations.push({
            filename,
            checksum: checksum(sql),
            body: transactionBody(sql, filename),
        });
    }

    const client = new Client({
        host: required('DB_HOST'),
        port,
        database: required('DB_NAME'),
        user: required('DB_MIGRATION_USER'),
        password: required('DB_MIGRATION_PASSWORD'),
        connectionTimeoutMillis: 5000,
        // Проверка сертификата остаётся включённой.
        ssl: sslValue === 'true'
            ? {
                rejectUnauthorized: true,
                ...(caCertificate?.trim() ? { ca: caCertificate } : {}),
            }
            : false,
    });

    await client.connect();

    try {
        // Запуски миграций выполняются последовательно.
        await client.query('SELECT pg_advisory_lock(617204, 1)');

        await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        filename TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

        const { rows } = await client.query(`
      SELECT filename, checksum
      FROM public.schema_migrations
      ORDER BY filename
    `);

        const applied = new Map(
            rows.map((row) => [row.filename, row.checksum]),
        );

        for (const row of rows) {
            const migration = migrations.find(
                (item) => item.filename === row.filename,
            );

            if (!migration || migration.checksum !== row.checksum) {
                throw new Error(
                    `Применённая миграция удалена или изменена: ${row.filename}`,
                );
            }
        }

        if (applied.size === 0) {
            const result = await client.query(`
        SELECT to_regclass('public.employees') AS existing_table
      `);

            if (result.rows[0].existing_table !== null) {
                throw new Error(
                    'Обнаружена существующая HR-база без истории миграций. ' +
                    'Сначала нужно проверить её схему и зарегистрировать ' +
                    'ранее выполненные миграции.',
                );
            }
        }

        let count = 0;

        for (const migration of migrations) {
            if (applied.has(migration.filename)) {
                continue;
            }

            await client.query('BEGIN');

            try {
                await client.query(migration.body);

                await client.query(
                    `
            INSERT INTO public.schema_migrations (filename, checksum)
            VALUES ($1, $2)
          `,
                    [migration.filename, migration.checksum],
                );

                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            }

            count += 1;
            console.log(`Применена: ${migration.filename}`);
        }

        console.log(`Готово. Применено миграций: ${count}`);
    } finally {
        // Закрытие соединения также освобождает advisory lock.
        await client.end();
    }
}

main().catch((error) => {
    console.error('Ошибка миграций:', error.message);
    process.exitCode = 1;
});
