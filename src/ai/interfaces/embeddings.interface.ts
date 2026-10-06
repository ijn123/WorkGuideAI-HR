export const EMBEDDINGS = Symbol('EMBEDDINGS');

export interface EmbeddingsInterface {
    /**
     * Создаёт вектор для каждого переданного текста.
     *
     * Порядок векторов соответствует порядку текстов.
     * Все векторы имеют одинаковую размерность.
     * При ошибке генерации метод выбрасывает исключение.
     */
    embedDocuments(texts: string[]): Promise<number[][]>;
}
