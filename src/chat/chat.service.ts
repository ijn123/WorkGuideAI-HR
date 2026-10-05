import { Inject, Injectable } from '@nestjs/common';
import {
    AI_CHAT,
    type AiChatInterface,
} from '../ai/interfaces/ai-chat.interface';
import type {
    AskQuestionResponseDto,
} from './dto/responses/ask-question-response.dto';

@Injectable()
export class ChatService {
    constructor(
        @Inject(AI_CHAT)
        private readonly aiChat: AiChatInterface,
    ) {}

    /**
     * Передаёт вопрос AI-сервису и формирует ответ приложения.
     *
     * @param question - Вопрос пользователя.
     * @returns Исходный вопрос и ответ модели.
     *
     * @remarks
     * Поиск по документам и HR-базе пока не выполняется.
     * Ошибки AI-сервиса передаются вызывающему коду.
     */
    async ask(question: string): Promise<AskQuestionResponseDto> {
        const answer = await this.aiChat.ask(question);

        return {
            question,
            answer,
        };
    }
}