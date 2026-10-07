import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { validateEnvironment } from '../src/config/env.schema';
import { IngestionModule } from '../src/ingestion/ingestion.module';
import { IngestionService } from '../src/ingestion/ingestion.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            validate: validateEnvironment,
        }),
        IngestionModule,
    ],
})
class CheckModule {}

async function main(): Promise<void> {
    const buffer = await readFile('sample-hr.txt');

    const app = await NestFactory.createApplicationContext(
        CheckModule,
        { logger: false },
    );

    try {
        const service = app.get(IngestionService);

        const result = await service.indexDocument({
            documentId: '50000000-0000-4000-8000-000000000027',
            filename: 'sample-hr.txt',
            buffer,
        });

        console.log('Индексация завершена:');
        console.log(result);
    } finally {
        await app.close();
    }
}

main().catch((error: unknown) => {
    console.error(
        'Ошибка индексации:',
        error instanceof Error ? error.message : 'Неизвестная ошибка',
    );
    process.exitCode = 1;
});