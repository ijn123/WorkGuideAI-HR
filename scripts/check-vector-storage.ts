import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { QdrantClient } from '@qdrant/js-client-rest';
import { validateEnvironment } from '../src/config/env.schema';
import { VectorStorageModule } from '../src/vector-storage/vector-storage.module';
import {
    VECTOR_STORAGE,
    type VectorStorageInterface,
    type VectorizedChunk,
} from '../src/vector-storage/interfaces/vector-storage.interface';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            validate: validateEnvironment,
        }),
        VectorStorageModule,
    ],
})
class CheckModule {}

async function main(): Promise<void> {
    const app = await NestFactory.createApplicationContext(
        CheckModule,
        { logger: false },
    );

    try {
        const storage = app.get<VectorStorageInterface>(VECTOR_STORAGE);
        const config = app.get(ConfigService);

        const collection = config.getOrThrow<string>('QDRANT_COLLECTION');
        const dimensions = config.getOrThrow<number>(
            'GEMINI_EMBEDDING_DIMENSIONS',
        );

        const client = new QdrantClient({
            url: config.getOrThrow<string>('QDRANT_URL'),
            apiKey: config.get<string>('QDRANT_API_KEY') || undefined,
        });

        const documentId = randomUUID();
        const oldGeneration = randomUUID();
        const newGeneration = randomUUID();

        const vector = Array<number>(dimensions).fill(0);
        vector[0] = 1;

        const makeChunk = (
            generationId: string,
            text: string,
        ): VectorizedChunk => ({
            chunk: {
                id: randomUUID(),
                documentId,
                generationId,
                title: 'Проверка хранения',
                text,
                pageNumber: 1,
                chunkIndex: 0,
            },
            vector,
        });

        const filter = {
            must: [
                {
                    key: 'documentId',
                    match: { value: documentId },
                },
            ],
        };

        const count = async (): Promise<number> => {
            const result = await client.count(collection, {
                exact: true,
                filter,
            });

            return result.count;
        };

        await storage.ensureCollection();

        try {
            const oldChunk = makeChunk(oldGeneration, 'Первая версия');

            await storage.upsertChunks([oldChunk]);
            assert.equal(await count(), 1);
            console.log('Запись: OK');

            await storage.upsertChunks([oldChunk]);
            assert.equal(await count(), 1);
            console.log('Повторная запись без дублей: OK');

            const newChunk = makeChunk(newGeneration, 'Вторая версия');

            await storage.upsertChunks([newChunk]);
            assert.equal(await count(), 2);

            await storage.deleteOtherGenerations(
                documentId,
                newGeneration,
            );
            assert.equal(await count(), 1);

            const remaining = await client.retrieve(collection, {
                ids: [newChunk.chunk.id],
                with_payload: true,
                with_vector: false,
            });

            assert.equal(remaining.length, 1);
            assert.equal(remaining[0]?.payload?.documentId, documentId);
            assert.equal(
                remaining[0]?.payload?.generationId,
                newGeneration,
            );
            assert.equal(remaining[0]?.payload?.text, 'Вторая версия');
            assert.equal(remaining[0]?.payload?.pageNumber, 1);

            console.log('Замена версии и сохранение метаданных: OK');

            await storage.deleteGeneration(documentId, newGeneration);
            assert.equal(await count(), 0);
            console.log('Удаление генерации: OK');
        } finally {
            // Удаляем только данные этого проверочного запуска.
            await storage.deleteGeneration(documentId, oldGeneration);
            await storage.deleteGeneration(documentId, newGeneration);
        }
    } finally {
        await app.close();
    }
}

main().catch((error: unknown) => {
    console.error(
        'Ошибка проверки:',
        error instanceof Error ? error.message : 'Неизвестная ошибка',
    );
    process.exitCode = 1;
});