export const DOCUMENT_RETRIEVAL_REPOSITORY = Symbol(
    'DOCUMENT_RETRIEVAL_REPOSITORY',
);

export interface RetrievableDocument {
    documentId: string;
    generationId: string;
    title: string;
}

export interface DocumentRetrievalRepositoryInterface {
    /**
     * Returns published, indexed documents available to the given role.
     * The role must come from verified authentication.
     *
     * Only ready documents with a current generation are returned.
     */
    findAvailableForRole(role: string): Promise<RetrievableDocument[]>;

    /**
     * Rechecks access and indexing state for selected documents.
     * The caller must compare generations with retrieved chunks.
     *
     * An empty documentIds array returns no documents.
     */
    findAvailableByIds(
        role: string,
        documentIds: string[],
    ): Promise<RetrievableDocument[]>;
}