export const DOCUMENT_RAG = Symbol('DOCUMENT_RAG');

export interface DocumentRagInput {
    question: string;

    /**
     * Must come from verified authentication.
     * Never accept this value directly from the request body.
     */
    role: string;
}

export interface DocumentSource {
    sourceId: string;
    documentId: string;
    generationId: string;
    chunkId: string;
    title: string;
    pageNumber: number | null;
}

export interface DocumentRagResult {
    answer: string;
    insufficientInformation: boolean;
    sources: DocumentSource[];
}

export interface DocumentRagInterface {
    /**
     * Answers using accessible document evidence within a context budget.
     * Returns only sources actually cited in the validated answer.
     * Returns an explicit insufficient-information result without evidence.
     */
    ask(input: DocumentRagInput): Promise<DocumentRagResult>;
}