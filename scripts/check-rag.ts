import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { validateEnvironment } from '../src/config/env.schema';
import { DocumentRagModule } from '../src/chat/document-rag.module';
import {
    DOCUMENT_RAG,
    type DocumentRagInterface,
} from '../src/chat/interfaces/document-rag.interface';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            validate: validateEnvironment,
        }),
        DocumentRagModule,
    ],
})
class CheckModule {}

async function main(): Promise<void> {
    const app = await NestFactory.createApplicationContext(
        CheckModule,
        { logger: ['error'] },
    );

    try {
        const rag = app.get<DocumentRagInterface>(DOCUMENT_RAG);

        const question = process.argv[2] ??
            'How do employees request vacation?';

        // Fixed role for local verification, not HTTP authentication.
        const result = await rag.ask({
            question,
            role: 'employee',
        });

        console.log(JSON.stringify(result, null, 2));
    } finally {
        await app.close();
    }
}

main().catch((error: unknown) => {
    console.error(
        'Ошибка RAG:',
        error instanceof Error ? error.message : 'Неизвестная ошибка',
    );
    process.exitCode = 1;
});