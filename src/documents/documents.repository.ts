import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { Document } from './document.entity';
import {
    toDocumentEntity,
    type DocumentRow,
} from './mappers/document-entity.mapper';
import type {
    DocumentsRepositoryInterface,
} from './interfaces/documents-repository.interface';


@Injectable()
export class DocumentsRepository
    implements DocumentsRepositoryInterface
{
    constructor(private readonly database: DatabaseService) {}

    async findAll(): Promise<Document[]> {
        const rows = await this.database.query<DocumentRow>(
            `
        SELECT
          id,
          title,
          status,
          allowed_roles
        FROM documents
        ORDER BY created_at DESC, id
        LIMIT 100
      `,
        );

        return rows.map(toDocumentEntity);
    }

    async findById(id: string): Promise<Document | null> {
        const rows = await this.database.query<DocumentRow>(
            `
        SELECT
          id,
          title,
          status,
          allowed_roles
        FROM documents
        WHERE id = $1
      `,
            [id],
        );

        const row = rows[0];

        return row ? toDocumentEntity(row) : null;
    }
    /**
     * Захватывает документ для индексации одним атомарным UPDATE.
     * Если документ уже индексируется, возвращает false.
     */
    async tryStartIndexing(
        documentId: string,
        generationId: string,
    ): Promise<boolean> {
        const rows = await this.database.query<{ id: string }>(
            `
                UPDATE documents
                SET indexing_status = 'indexing',
                    indexing_generation = $2,
                    indexed_at = NULL,
                    indexing_error = NULL
                WHERE id = $1
                  AND indexing_status <> 'indexing'
                RETURNING id
            `,
            [documentId, generationId],
        );

        return rows.length === 1;
    }

    /**
     * Завершает только текущую попытку индексации.
     */
    async markIndexingReady(
        documentId: string,
        generationId: string,
    ): Promise<boolean> {
        const rows = await this.database.query<{ id: string }>(
            `
                UPDATE documents
                SET indexing_status = 'ready',
                    indexed_at = CURRENT_TIMESTAMP,
                    indexing_error = NULL
                WHERE id = $1
                  AND indexing_generation = $2
                  AND indexing_status = 'indexing'
                RETURNING id
            `,
            [documentId, generationId],
        );

        return rows.length === 1;
    }

    /**
     * Сохраняет безопасное описание ошибки текущей попытки.
     */
    async markIndexingFailed(
        documentId: string,
        generationId: string,
        errorMessage: string,
    ): Promise<boolean> {
        const rows = await this.database.query<{ id: string }>(
            `
                UPDATE documents
                SET indexing_status = 'failed',
                    indexed_at = NULL,
                    indexing_error = $3
                WHERE id = $1
                  AND indexing_generation = $2
                  AND indexing_status = 'indexing'
                RETURNING id
            `,
            [documentId, generationId, errorMessage],
        );

        return rows.length === 1;
    }
}