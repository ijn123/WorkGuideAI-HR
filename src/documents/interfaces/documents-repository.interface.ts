import type { Document } from '../document.entity';

export const DOCUMENTS_REPOSITORY = Symbol(
    'DOCUMENTS_REPOSITORY',
);

export interface DocumentsRepositoryInterface {
    /**
     * Возвращает документы в пределах лимита реализации.
     *
     * @remarks
     * Результат не отфильтрован по правам доступа.
     */
    findAll(): Promise<Document[]>;

    /**
     * Находит документ по идентификатору.
     *
     * @returns Документ или null, если запись отсутствует.
     */
    findById(id: string): Promise<Document | null>;

    /**
     * Атомарно переводит документ в indexing и записывает
     * идентификатор новой попытки индексации.
     *
     * Сбрасывает предыдущие indexed_at и indexing_error.
     * Статус публикации документа не изменяется.
     *
     * @returns false, если документ отсутствует
     * или уже находится в состоянии indexing.
     */
    tryStartIndexing(
        documentId: string,
        generationId: string,
    ): Promise<boolean>;

    /**
     * Переводит документ в ready и устанавливает indexed_at,
     * только если он находится в indexing с указанной генерацией.
     *
     * @returns true, если запись была обновлена.
     */
    markIndexingReady(
        documentId: string,
        generationId: string,
    ): Promise<boolean>;

    /**
     * Marks the current indexing attempt as failed.
     * Updates only a matching generation in the indexing state.
     *
     * @param documentId ID of the document.
     * @param generationId ID of the current indexing attempt.
     * @param errorMessage Safe description without secrets,
     * personal data, or document content.
     * @returns Whether the document was updated.
     */
    markIndexingFailed(
        documentId: string,
        generationId: string,
        errorMessage: string,
    ): Promise<boolean>;
}
