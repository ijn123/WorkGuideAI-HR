import type { DocumentChunk } from '../../ingestion/types/document-chunk';

export const VECTOR_STORAGE = Symbol('VECTOR_STORAGE');

export interface VectorizedChunk {
    chunk: DocumentChunk;
    vector: number[];
}

export interface VectorStorageInterface {
    ensureCollection(): Promise<void>;

    /**
     * Записывает фрагменты вместе с векторами и метаданными.
     * Повторная запись тех же ID обновляет существующие точки.
     */
    upsertChunks(chunks: VectorizedChunk[]): Promise<void>;

    /**
     * Удаляет фрагменты конкретной попытки индексации.
     * Используется для очистки после ошибки.
     */
    deleteGeneration(
        documentId: string,
        generationId: string,
    ): Promise<void>;

    /**
     * Удаляет предыдущие версии фрагментов документа,
     * сохраняя указанную успешно записанную версию.
     */
    deleteOtherGenerations(
        documentId: string,
        generationId: string,
    ): Promise<void>;
}