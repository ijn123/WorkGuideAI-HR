import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { validateEnvironment } from '../src/config/env.schema';
import { VectorStorageModule } from '../src/vector-storage/vector-storage.module';
import { QdrantService } from '../src/vector-storage/qdrant.service';

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
        const qdrant = app.get(QdrantService);
        const config = app.get(ConfigService);

        await qdrant.ensureCollection();

        console.log(
            'Коллекция готова:',
            config.getOrThrow<string>('QDRANT_COLLECTION'),
        );
        console.log(
            'Размерность:',
            config.getOrThrow<number>('GEMINI_EMBEDDING_DIMENSIONS'),
        );
        console.log('Метрика: Cosine');
    } finally {
        await app.close();
    }
}

main().catch((error: unknown) => {
    console.error(
        'Ошибка проверки Qdrant:',
        error instanceof Error ? error.message : 'Неизвестная ошибка',
    );
    process.exitCode = 1;
});