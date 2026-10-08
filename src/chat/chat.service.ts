import { Inject, Injectable } from '@nestjs/common';
import type {
    AuthenticatedUser,
} from '../auth/types/authenticated-user';
import {
    QUESTION_ORCHESTRATOR,
    type QuestionOrchestratorInterface,
} from './interfaces/question-orchestrator.interface';
import type {
    AskQuestionResponseDto,
} from './dto/responses/ask-question-response.dto';

@Injectable()
export class ChatService {
    constructor(
        @Inject(QUESTION_ORCHESTRATOR)
        private readonly orchestrator: QuestionOrchestratorInterface,
    ) {}

    /**
     * Processes a question using the authenticated user's context.
     *
     * @param question - The validated user question.
     * @param user - Identity and role from verified authentication.
     * @returns The question and routing result with sources and statuses.
     *
     * @remarks
     * Infrastructure and unexpected errors propagate to the caller.
     */
    async ask(
        question: string,
        user: AuthenticatedUser,
    ): Promise<AskQuestionResponseDto> {
        const result = await this.orchestrator.ask(question, user);

        return {
            question,
            result,
        };
    }
}