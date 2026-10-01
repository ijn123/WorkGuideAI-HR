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
}