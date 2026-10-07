import type { RetrievedChunk } from '../../vector-storage/interfaces/vector-search.interface';

export const DOCUMENT_RETRIEVAL = Symbol('DOCUMENT_RETRIEVAL');

export interface DocumentRetrievalInput {
    question: string;

    /**
     * Must come from verified authentication,
     * never directly from the request body.
     */
    role: string;
}

export interface DocumentRetrievalInterface {
    /**
     * Embeds the question and searches accessible document generations.
     * Rechecks publication, access, and generation before returning chunks.
     * Returns an empty array when no relevant evidence is available.
     */
    retrieve(input: DocumentRetrievalInput): Promise<RetrievedChunk[]>;
}
