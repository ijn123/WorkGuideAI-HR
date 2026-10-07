import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    EMBEDDINGS,
    type EmbeddingsInterface,
} from '../ai/interfaces/embeddings.interface';
import {
    DOCUMENT_RETRIEVAL_REPOSITORY,
    type DocumentRetrievalRepositoryInterface,
} from '../documents/interfaces/document-retrieval-repository.interface';
import {
    VECTOR_SEARCH,
    type VectorSearchInterface,
    type RetrievedChunk,
} from '../vector-storage/interfaces/vector-search.interface';
import type {
    DocumentRetrievalInput,
    DocumentRetrievalInterface,
} from './interfaces/document-retrieval.interface';

@Injectable()
export class DocumentRetrievalService
    implements DocumentRetrievalInterface
{
    constructor(
        private readonly config: ConfigService,

        @Inject(EMBEDDINGS)
        private readonly embeddings: EmbeddingsInterface,

        @Inject(DOCUMENT_RETRIEVAL_REPOSITORY)
        private readonly documents: DocumentRetrievalRepositoryInterface,

        @Inject(VECTOR_SEARCH)
        private readonly vectorSearch: VectorSearchInterface,
    ) {}

    /**
     * Retrieves relevant chunks and rechecks current document access.
     * The caller must supply a role from verified authentication.
     */
    async retrieve(
        input: DocumentRetrievalInput,
    ): Promise<RetrievedChunk[]> {
        const question = input.question.trim();

        if (!question) {
            throw new Error('Вопрос не должен быть пустым.');
        }

        const allowedDocuments =
            await this.documents.findAvailableForRole(input.role);

        if (allowedDocuments.length === 0) {
            return [];
        }

        const vector = await this.embeddings.embedQuery(question);

        const chunks = await this.vectorSearch.search({
            vector,
            allowedDocuments,
            limit: this.config.getOrThrow<number>('RETRIEVAL_TOP_K'),
            scoreThreshold: this.config.getOrThrow<number>(
                'RETRIEVAL_SCORE_THRESHOLD',
            ),
        });

        if (chunks.length === 0) {
            return [];
        }
        const documentIds = [
            ...new Set(chunks.map((chunk) => chunk.documentId)),
        ];

        const availableDocuments =
            await this.documents.findAvailableByIds(
                input.role,
                documentIds,
            );

        const documentsById = new Map(
            availableDocuments.map((document) => [
                document.documentId,
                document,
            ]),
        );

        const authorizedChunks: RetrievedChunk[] = [];

        for (const chunk of chunks) {
            const document = documentsById.get(chunk.documentId);

            if (
                !document ||
                document.generationId !== chunk.generationId
            ) {
                continue;
            }

            authorizedChunks.push({
                ...chunk,
                title: document.title,
            });
        }

        return authorizedChunks;
    }
}