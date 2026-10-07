export const EMBEDDINGS = Symbol('EMBEDDINGS');

export interface EmbeddingsInterface {
    /**
     * Generates one vector per document text.
     * Output order matches input order.
     * All vectors have the configured dimensionality.
     */
    embedDocuments(texts: string[]): Promise<number[][]>;

    /**
     * Generates a search query vector using the same model
     * and dimensionality as document indexing.
     */
    embedQuery(text: string): Promise<number[]>;

}
