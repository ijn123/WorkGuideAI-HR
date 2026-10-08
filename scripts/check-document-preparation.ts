import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { validateEnvironment } from '../src/config/env.schema';
import { IngestionModule } from '../src/ingestion/ingestion.module';
import { DocumentPreparationService } from '../src/ingestion/document-preparation.service';

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
    const filePath = process.argv[2];

    if (!filePath) {
        throw new Error('Укажи путь к файлу PDF, DOCX или TXT.');
    }

    const buffer = await readFile(filePath);
    const app = await NestFactory.createApplicationContext(CheckModule, {
        logger: false,
    });

    try {
        const service = app.get(DocumentPreparationService);

        const chunks = await service.prepare({
            documentId: randomUUID(),
            generationId: randomUUID(),
            title: basename(filePath),
            filename: basename(filePath),
            buffer,
        });

        console.log(`Фрагментов: ${chunks.length}`);

        console.table(
            chunks.map((chunk) => ({
                index: chunk.chunkIndex,
                page: chunk.pageNumber,
                characters: Array.from(chunk.text).length,
            })),
        );

        console.log('Начало первого фрагмента:');
        console.log(chunks[0]?.text.slice(0, 300));
    } finally {
        await app.close();
    }
}

main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
});