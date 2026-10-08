import type {
    QuestionAnswerResult,
} from '../../interfaces/question-orchestrator.interface';

export interface AskQuestionResponseDto {
    /** The original user question. */
    question: string;

    /** Routing result, source references, and data availability. */
    result: QuestionAnswerResult;
}