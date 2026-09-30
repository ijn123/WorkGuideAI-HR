import {
    Injectable,
    Logger,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, type QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService
    implements OnModuleInit, OnModuleDestroy
{
    private readonly logger = new Logger(DatabaseService.name);
    private readonly pool: Pool;

    constructor(private readonly config: ConfigService) {
        const useSsl =
            this.config.get<string>('DB_SSL', 'false').toLowerCase() === 'true';

        const poolConfig = {
            host: this.config.getOrThrow<string>('DB_HOST'),
            port: this.config.getOrThrow<number>('DB_PORT'),
            database: this.config.getOrThrow<string>('DB_NAME'),
            user: this.config.getOrThrow<string>('DB_USER'),
            password: this.config.getOrThrow<string>('DB_PASSWORD'),
            connectionTimeoutMillis: 5000,

            ...(useSsl
                ? {
                      ssl: {
                          rejectUnauthorized: false,
                      },
                  }
                : {}),
        };

        this.pool = new Pool(poolConfig);

        this.pool.on('error', (error: Error) => {
            this.logger.error(
                'Ошибка фонового соединения PostgreSQL.',
                error.stack,
            );
        });
    }

    async onModuleInit(): Promise<void> {
        await this.pool.query('SELECT 1');

        this.logger.log('Подключение к PostgreSQL установлено.');
    }

    async query<T extends QueryResultRow>(
        sql: string,
        params: unknown[] = [],
    ): Promise<T[]> {
        const result = await this.pool.query<T>(sql, params);

        return result.rows;
    }

    async onModuleDestroy(): Promise<void> {
        await this.pool.end();
    }
}