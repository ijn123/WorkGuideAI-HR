import type {
    QuestionRoutingDecision,
} from '../schemas/question-routing.schema';

export const QUESTION_ROUTER = Symbol('QUESTION_ROUTER');

export interface QuestionRoutingInput {
    question: string;

    /**
     * Current year supplied by the application, not by the model.
     * Used to interpret explicit references such as "this year".
     */
    currentYear: number;
}

export interface QuestionRouterInterface {
    /**
     * Classifies a question and validates the proposed operations.
     * Requests clarification when the question is ambiguous.
     *
     * Does not execute operations or determine employee identity.
     * Invalid model output must never be executed.
     */
    route(
        input: QuestionRoutingInput,
    ): Promise<QuestionRoutingDecision>;
}
