import {
    Injectable,
    Logger,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService
    implements OnModuleInit, OnModuleDestroy
{
    private readonly logger = new Logger(DatabaseService.name);
    private readonly pool: Pool;

    constructor(private readonly config: ConfigService) {
        this.pool = new Pool({
            host: this.config.getOrThrow<string>('DB_HOST'),
            port: Number(this.config.getOrThrow<string>('DB_PORT')),
            database: this.config.getOrThrow<string>('DB_NAME'),
            user: this.config.getOrThrow<string>('DB_USER'),
            password: this.config.getOrThrow<string>('POSTGRES_PASSWORD'),
            connectionTimeoutMillis: 5000,
        });

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

    async onModuleDestroy(): Promise<void> {
        await this.pool.end();
    }
}