import {
    Injectable,
    ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatGoogle } from '@langchain/google';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import type {
    GroundedAnswerInput,
    GroundedAnswerInterface,
    GroundedAnswerResult,
} from './interfaces/grounded-answer.interface';
import { groundedAnswerSchema } from './schemas/grounded-answer.schema';
import { GROUNDED_ANSWER_SYSTEM_PROMPT } from '../prompts/grounded-answer.prompt';

@Injectable()
export class GroundedAnswerService implements GroundedAnswerInterface {
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
     * Generates an answer from supplied evidence only.
     * Validates model output before returning it to the caller.
     */
    async generate(
        input: GroundedAnswerInput,
    ): Promise<GroundedAnswerResult> {
        const question = input.question.trim();

        if (!question) {
            throw new Error('Вопрос не должен быть пустым.');
        }

        if (input.evidence.length === 0) {
            return {
                answer: 'В доступных документах недостаточно информации для ответа.',
                insufficientInformation: true,
                sourceIds: [],
            };
        }

        const allowedSourceIds = new Set(
            input.evidence.map((item) => item.sourceId),
        );

        if (
            allowedSourceIds.size !== input.evidence.length ||
            input.evidence.some(
                (item) =>
                    !/^S[1-9]\d*$/.test(item.sourceId) ||
                    !item.text.trim(),
            )
        ) {
            throw new Error('Некорректные источники для генерации ответа.');
        }

        try {
            const chain = this.model.pipe(new StringOutputParser());

            const rawAnswer = await chain.invoke([
                new SystemMessage(GROUNDED_ANSWER_SYSTEM_PROMPT),
                new HumanMessage(
                    JSON.stringify({
                        question,
                        evidence: input.evidence,
                    }),
                ),
            ]);

            const result = groundedAnswerSchema.parse(
                JSON.parse(rawAnswer.trim()),
            );
            const citedSourceIds = new Set(
                Array.from(
                    result.answer.matchAll(/\[(S[1-9]\d*)]/g),
                    (match) => match[1],
                ),
            );

            if (
                result.sourceIds.some(
                    (sourceId) => !allowedSourceIds.has(sourceId),
                )
            ) {
                throw new Error('Model returned an unknown source ID.');
            }

            const declaredSourceIds = new Set(result.sourceIds);

            if (
                citedSourceIds.size !== declaredSourceIds.size ||
                [...citedSourceIds].some(
                    (sourceId) => !declaredSourceIds.has(sourceId),
                )
            ) {
                throw new Error(
                    'Inline citations do not match the declared sources.',
                );
            }

            if (result.insufficientInformation) {
                return {
                    answer: 'В доступных документах недостаточно информации для ответа.',
                    insufficientInformation: true,
                    sourceIds: [],
                };
            }

            return result;
        } catch {
            throw new ServiceUnavailableException(
                'Не удалось получить корректный ответ по документам. Попробуйте позже.',
            );
        }
    }
}