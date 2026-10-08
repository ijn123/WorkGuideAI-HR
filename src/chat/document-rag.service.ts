import {
    Inject,
    Injectable,
    ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    DOCUMENT_RETRIEVAL,
    type DocumentRetrievalInterface,
} from '../retrieval/interfaces/document-retrieval.interface';
import {
    DOCUMENT_RETRIEVAL_REPOSITORY,
    type DocumentRetrievalRepositoryInterface,
} from '../documents/interfaces/document-retrieval-repository.interface';
import {
    GROUNDED_ANSWER,
    type GroundedAnswerInterface,
    type GroundedEvidence,
} from '../ai/interfaces/grounded-answer.interface';
import type {
    DocumentRagInput,
    DocumentRagInterface,
    DocumentRagResult,
    DocumentSource,
} from './interfaces/document-rag.interface';

@Injectable()
export class DocumentRagService implements DocumentRagInterface {
    constructor(
        private readonly config: ConfigService,

        @Inject(DOCUMENT_RETRIEVAL)
        private readonly retrieval: DocumentRetrievalInterface,

        @Inject(DOCUMENT_RETRIEVAL_REPOSITORY)
        private readonly documents: DocumentRetrievalRepositoryInterface,

        @Inject(GROUNDED_ANSWER)
        private readonly groundedAnswer: GroundedAnswerInterface,
    ) {}

    /**
     * Builds bounded evidence and generates an answer with verified sources.
     * Rechecks access before generation and before returning the answer.
     */
    async ask(input: DocumentRagInput): Promise<DocumentRagResult> {
        const question = input.question.trim();

        if (!question) {
            throw new Error('Вопрос не должен быть пустым.');
        }

        const insufficient = (): DocumentRagResult => ({
            answer: 'В доступных документах недостаточно информации для ответа.',
            insufficientInformation: true,
            sources: [],
        });

        console.log('[RAG] Начало поиска фрагментов');

        const retrievalStartedAt = Date.now();

        const chunks = await this.retrieval.retrieve({
            question,
            role: input.role,
        });
        console.log('[RAG] Поиск, мс:', Date.now() - retrievalStartedAt);

        console.log('[RAG] Поиск завершён, фрагментов:', chunks.length);

        if (chunks.length === 0) {
            return insufficient();
        }
        const maxContextChars = this.config.getOrThrow<number>(
            'RAG_MAX_CONTEXT_CHARS',
        );

        const evidence: GroundedEvidence[] = [];
        const sourcesById = new Map<string, DocumentSource>();

        for (const chunk of chunks) {
            const sourceId = `S${evidence.length + 1}`;

            const item: GroundedEvidence = {
                sourceId,
                documentId: chunk.documentId,
                chunkId: chunk.id,
                title: chunk.title,
                pageNumber: chunk.pageNumber,
                text: chunk.text,
            };

            // Count serialized evidence, including metadata and JSON escaping.
            const candidate = JSON.stringify([...evidence, item]);

            if (Array.from(candidate).length > maxContextChars) {
                continue;
            }

            evidence.push(item);
            sourcesById.set(sourceId, {
                sourceId,
                documentId: chunk.documentId,
                generationId: chunk.generationId,
                chunkId: chunk.id,
                title: chunk.title,
                pageNumber: chunk.pageNumber,
            });
        }

        if (evidence.length === 0) {
            return insufficient();
        }

        const documentIds = [
            ...new Set(evidence.map((item) => item.documentId)),
        ];

        const availableBeforeGeneration =
            await this.documents.findAvailableByIds(
                input.role,
                documentIds,
            );

        const generationsBeforeGeneration = new Map(
            availableBeforeGeneration.map((document) => [
                document.documentId,
                document.generationId,
            ]),
        );

        const authorizedEvidence = evidence.filter((item) => {
            const source = sourcesById.get(item.sourceId);

            return (
                source !== undefined &&
                generationsBeforeGeneration.get(source.documentId) ===
                source.generationId
            );
        });

        if (authorizedEvidence.length === 0) {
            return insufficient();
        }

        const generated = await this.groundedAnswer.generate({
            question,
            evidence: authorizedEvidence,
        });
        if (generated.insufficientInformation) {
            return insufficient();
        }

        const authorizedSourceIds = new Set(
            authorizedEvidence.map((item) => item.sourceId),
        );

        if (
            generated.sourceIds.length === 0 ||
            generated.sourceIds.some(
                (sourceId) => !authorizedSourceIds.has(sourceId),
            )
        ) {
            throw new ServiceUnavailableException(
                'Ответ содержит некорректные ссылки на источники.',
            );
        }

        // Recheck every document sent to the model, not only cited ones.
        const usedDocumentIds = [
            ...new Set(
                authorizedEvidence.map((item) => item.documentId),
            ),
        ];

        const availableAfterGeneration =
            await this.documents.findAvailableByIds(
                input.role,
                usedDocumentIds,
            );

        const currentGenerations = new Map(
            availableAfterGeneration.map((document) => [
                document.documentId,
                document.generationId,
            ]),
        );

        const accessChanged = authorizedEvidence.some((item) => {
            const source = sourcesById.get(item.sourceId);

            return (
                source === undefined ||
                currentGenerations.get(source.documentId) !==
                source.generationId
            );
        });

        if (accessChanged) {
            return insufficient();
        }

        const sources: DocumentSource[] = [];

        for (const sourceId of new Set(generated.sourceIds)) {
            const source = sourcesById.get(sourceId);

            if (!source) {
                throw new ServiceUnavailableException(
                    'Не удалось сформировать источники ответа.',
                );
            }

            sources.push(source);
        }

        return {
            answer: generated.answer,
            insufficientInformation: false,
            sources,
        };
    }
}