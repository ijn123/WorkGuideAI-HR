import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { validateEnvironment } from '../src/config/env.schema';
import { RetrievalModule } from '../src/retrieval/retrieval.module';
import {
    DOCUMENT_RETRIEVAL,
    type DocumentRetrievalInterface,
} from '../src/retrieval/interfaces/document-retrieval.interface';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            validate: validateEnvironment,
        }),
        RetrievalModule,
    ],
})
class CheckModule {}

async function main(): Promise<void> {
    const app = await NestFactory.createApplicationContext(
        CheckModule,
        { logger: ['error'] },
    );

    try {
        const retrieval = app.get<DocumentRetrievalInterface>(
            DOCUMENT_RETRIEVAL,
        );

        // Fixed role for this local check, not HTTP authentication.
        const chunks = await retrieval.retrieve({
            question: 'How do employees request vacation?',
            role: 'employee',
        });

        const demoChunks = chunks.filter(
            (chunk) =>
                chunk.documentId ===
                '50000000-0000-4000-8000-000000000027',
        );

        console.log('Всего найдено фрагментов:', chunks.length);
        console.log('Фрагментов учебного документа:', demoChunks.length);

        console.table(
            chunks.map((chunk) => ({
                documentId: chunk.documentId,
                generationId: chunk.generationId,
                chunkId: chunk.id,
                page: chunk.pageNumber,
                score: chunk.score,
            })),
        );
    } finally {
        await app.close();
    }
}

main().catch((error: unknown) => {
    console.error(
        'Ошибка поиска:',
        error instanceof Error ? error.message : 'Неизвестная ошибка',
    );
    process.exitCode = 1;
});