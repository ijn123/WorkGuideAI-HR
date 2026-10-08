import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { validateEnvironment } from '../src/config/env.schema';
import { QuestionRoutingModule } from '../src/chat/question-routing.module';
import {
    QUESTION_ROUTER,
    type QuestionRouterInterface,
} from '../src/chat/interfaces/question-router.interface';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            validate: validateEnvironment,
        }),
        QuestionRoutingModule,
    ],
})
class CheckModule {}

async function main(): Promise<void> {
    const question = process.argv[2];

    if (!question?.trim()) {
        throw new Error('Укажи вопрос в кавычках после команды.');
    }

    const app = await NestFactory.createApplicationContext(
        CheckModule,
        { logger: ['error'] },
    );

    try {
        const router = app.get<QuestionRouterInterface>(QUESTION_ROUTER);

        const result = await router.route({
            question,
            currentYear: new Date().getUTCFullYear(),
        });

        console.log(JSON.stringify(result, null, 2));
    } finally {
        await app.close();
    }
}

main().catch((error: unknown) => {
    console.error(
        'Ошибка маршрутизации:',
        error instanceof Error ? error.message : 'Неизвестная ошибка',
    );
    process.exitCode = 1;
});