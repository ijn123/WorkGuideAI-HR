import {
    Inject,
    Injectable,
    ServiceUnavailableException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import {
    QUESTION_ROUTER,
    type QuestionRouterInterface,
} from './interfaces/question-router.interface';
import {
    HR_OPERATION_EXECUTOR,
    type HrOperationExecutorInterface,
    type HrOperationResult,
} from './interfaces/hr-operation-executor.interface';
import {
    DOCUMENT_RAG,
    type DocumentRagInterface,
} from './interfaces/document-rag.interface';
import type {
    DocumentQuestionResult,
    QuestionAnswerResult,
    QuestionOrchestratorInterface,
} from './interfaces/question-orchestrator.interface';
import {
    questionRoutingSchema,
    type HrOperation,
} from './schemas/question-routing.schema';

@Injectable()
export class QuestionOrchestratorService
    implements QuestionOrchestratorInterface
{
    constructor(
        @Inject(QUESTION_ROUTER)
        private readonly router: QuestionRouterInterface,

        @Inject(HR_OPERATION_EXECUTOR)
        private readonly hrExecutor: HrOperationExecutorInterface,

        @Inject(DOCUMENT_RAG)
        private readonly documentRag: DocumentRagInterface,
    ) {}

    /**
     * Validates the routing decision before accessing either source.
     * Uses only the identity and role supplied by authentication.
     */
    async ask(
        question: string,
        user: AuthenticatedUser,
    ): Promise<QuestionAnswerResult> {
        const trimmedQuestion = question.trim();

        if (!trimmedQuestion) {
            throw new Error('Вопрос не должен быть пустым.');
        }

        const proposedDecision = await this.router.route({
            question: trimmedQuestion,
            currentYear: new Date().getUTCFullYear(),
        });

        const decision = questionRoutingSchema.parse(proposedDecision);
        switch (decision.route) {
            case 'CLARIFICATION':
                return {
                    route: 'CLARIFICATION',
                    question: decision.question,
                };

            case 'DOCUMENTS':
                return {
                    route: 'DOCUMENTS',
                    documents: await this.askDocuments(
                        trimmedQuestion,
                        user,
                    ),
                };

            case 'SQL':
                return {
                    route: 'SQL',
                    hr: await this.executeHrOperations(
                        decision.operations,
                        user,
                    ),
                };

            case 'HYBRID': {
                const [documents, hr] = await Promise.all([
                    this.askDocuments(trimmedQuestion, user),
                    this.executeHrOperations(decision.operations, user),
                ]);

                return {
                    route: 'HYBRID',
                    documents,
                    hr,
                };
            }
        }

        throw new Error('Unsupported question route.');
    }
    /**
     * Preserves document answers and source references.
     * Converts known availability failures into an explicit status.
     */
    private async askDocuments(
        question: string,
        user: AuthenticatedUser,
    ): Promise<DocumentQuestionResult> {
        try {
            const result = await this.documentRag.ask({
                question,
                role: user.role,
            });

            return {
                status: 'SUCCESS',
                data: result,
            };
        } catch (error: unknown) {
            if (error instanceof ServiceUnavailableException) {
                return {
                    status: 'UNAVAILABLE',
                };
            }

            // Do not hide authorization failures or unexpected errors.
            throw error;
        }
    }

    /**
     * Executes validated HR operations for the authenticated employee.
     * Preserves operation order and individual result statuses.
     */
    private async executeHrOperations(
        operations: HrOperation[],
        user: AuthenticatedUser,
    ): Promise<HrOperationResult[]> {
        const results: HrOperationResult[] = [];

        for (const operation of operations) {
            results.push(
                await this.hrExecutor.execute(operation, user),
            );
        }

        return results;
    }
}