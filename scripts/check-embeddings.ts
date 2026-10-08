import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { validateEnvironment } from '../src/config/env.schema';
import { EmbeddingsService } from '../src/ai/embeddings.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            validate: validateEnvironment,
        }),
    ],
    providers: [EmbeddingsService],
})
class CheckModule {}

async function main(): Promise<void> {
    const app = await NestFactory.createApplicationContext(
        CheckModule,
        { logger: false },
    );

    try {
        const service = app.get(EmbeddingsService);

        const vectors = await service.embedDocuments([
            'Employees can request vacation through the HR portal.',
            'New employees must complete security training.',
        ]);

        console.log(`Получено векторов: ${vectors.length}`);

        console.table(
            vectors.map((vector, index) => ({
                index,
                dimensions: vector.length,
                validNumbers: vector.every(Number.isFinite),
            })),
        );
    } finally {
        await app.close();
    }
}

main().catch((error: unknown) => {
    console.error(
        'Ошибка проверки эмбеддингов:',
        error instanceof Error ? error.message : 'Неизвестная ошибка',
    );
    process.exitCode = 1;
});