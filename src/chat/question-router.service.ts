import {
    Injectable,
    ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatGoogle } from '@langchain/google';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import {
    questionRoutingSchema,
    type QuestionRoutingDecision,
} from './schemas/question-routing.schema';
import type {
    QuestionRouterInterface,
    QuestionRoutingInput,
} from './interfaces/question-router.interface';
import { QUESTION_ROUTING_SYSTEM_PROMPT } from '../prompts/question-routing.prompt';

@Injectable()
export class QuestionRouterService implements QuestionRouterInterface {
    private readonly model: ChatGoogle;

    constructor(config: ConfigService) {
        const apiKey = config
            .getOrThrow<string>('GEMINI_API_KEY')
            .trim();

        const modelName = config
            .getOrThrow<string>('GEMINI_CHAT_MODEL')
            .trim();

        if (!apiKey || !modelName) {
            throw new Error(
                'Заполните GEMINI_API_KEY и GEMINI_CHAT_MODEL в .env.',
            );
        }

        this.model = new ChatGoogle({
            apiKey,
            model: modelName,
            maxRetries: 1,
        });
    }
    /**
     * Classifies the question without executing any operations.
     * Rejects malformed or unsupported model decisions.
     */
    async route(
        input: QuestionRoutingInput,
    ): Promise<QuestionRoutingDecision> {
        const question = input.question.trim();

        if (!question) {
            throw new Error('Вопрос не должен быть пустым.');
        }

        if (
            !Number.isInteger(input.currentYear) ||
            input.currentYear < 2000 ||
            input.currentYear > 2100
        ) {
            throw new Error('Некорректный текущий год.');
        }

        try {
            const chain = this.model.pipe(new StringOutputParser());

            const rawDecision = await chain.invoke([
                new SystemMessage(QUESTION_ROUTING_SYSTEM_PROMPT),
                new HumanMessage(
                    JSON.stringify({
                        question,
                        currentYear: input.currentYear,
                    }),
                ),
            ]);

            return questionRoutingSchema.parse(
                JSON.parse(rawDecision.trim()),
            );
        } catch (error: unknown) {
            console.error(
                'Routing diagnostic:',
                error instanceof Error ? error.message : 'Unknown error',
            );

            throw new ServiceUnavailableException(
                'Не удалось определить способ обработки вопроса. Попробуйте позже.',
            );
        }
    }
}