const assert = require('node:assert/strict');
const { describe, it, mock } = require('node:test');
const { ServiceUnavailableException } = require('@nestjs/common');
const { DatabaseService } = require('../../dist/database/database.service');

describe('DatabaseService', () => {
    it('returns a safe 503 response when a PostgreSQL query fails', async () => {
        const databaseError = new Error('Fake PostgreSQL failure');
        const pool = {
            query: async () => {
                throw databaseError;
            },
            on: () => {},
        };

        const config = {
            get: () => 'false',
            getOrThrow: key => {
                const values = {
                    DB_HOST: 'localhost',
                    DB_PORT: 5432,
                    DB_NAME: 'test',
                    DB_USER: 'test',
                    DB_PASSWORD: 'test',
                };

                return values[key];
            },
        };

        const database = new DatabaseService(config);
        mock.method(database, 'onModuleInit', async () => {});
        Object.defineProperty(database, 'pool', {
            value: pool,
            configurable: true,
        });

        await assert.rejects(
            database.query('SELECT 1'),
            error => error instanceof ServiceUnavailableException
                && error.message === 'Сервис базы данных временно недоступен. Попробуйте позже.',
        );
    });
});