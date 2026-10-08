import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import type { DocumentRagResult } from './document-rag.interface';
import type { HrOperationResult } from './hr-operation-executor.interface';

export const QUESTION_ORCHESTRATOR = Symbol('QUESTION_ORCHESTRATOR');

export type DocumentQuestionResult =
    | {
    status: 'SUCCESS';
    data: DocumentRagResult;
}
    | {
    status: 'UNAVAILABLE';
};

export type QuestionAnswerResult =
    | {
    route: 'CLARIFICATION';
    question: string;
}
    | {
    route: 'DOCUMENTS';
    documents: DocumentQuestionResult;
}
    | {
    route: 'SQL';
    hr: HrOperationResult[];
}
    | {
    route: 'HYBRID';
    documents: DocumentQuestionResult;
    hr: HrOperationResult[];
};

export interface QuestionOrchestratorInterface {
    /**
     * Routes a question and executes only validated operations.
     * Identity and role must come from verified authentication.
     * Preserves document sources and structured-data result statuses.
     */
    ask(
        question: string,
        user: AuthenticatedUser,
    ): Promise<QuestionAnswerResult>;
}