import type { DocumentChunk } from '../../ingestion/types/document-chunk';

export const VECTOR_SEARCH = Symbol('VECTOR_SEARCH');

export interface AllowedDocumentGeneration {
    documentId: string;
    generationId: string;
}

export interface VectorSearchInput {
    vector: number[];
    allowedDocuments: AllowedDocumentGeneration[];
    limit: number;
    scoreThreshold: number;
}

export interface RetrievedChunk extends DocumentChunk {
    score: number;
}

export interface VectorSearchInterface {
    /**
     * Searches only within explicitly allowed document generations.
     * Applies the access filter and score threshold before top-k selection.
     *
     * An empty allowedDocuments list must return no results.
     * Results are ordered by descending similarity score.
     */
    search(input: VectorSearchInput): Promise<RetrievedChunk[]>;
}