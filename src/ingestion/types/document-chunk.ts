/**
 * Фрагмент текста для создания эмбеддинга и записи в Qdrant.
 */
export interface DocumentChunk {
    /** Уникальный UUID фрагмента. */
    id: string;

    /** Идентификатор исходного документа. */
    documentId: string;

    /** Идентификатор попытки индексации. */
    generationId: string;

    /** Название исходного документа. */
    title: string;

    /** Текст фрагмента. */
    text: string;

    /** Номер исходной страницы или null. */
    pageNumber: number | null;

    /** Порядковый номер фрагмента в документе, начиная с 0. */
    chunkIndex: number;
}
