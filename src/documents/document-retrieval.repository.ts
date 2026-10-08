import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type {
    DocumentRetrievalRepositoryInterface,
    RetrievableDocument,
} from './interfaces/document-retrieval-repository.interface';

@Injectable()
export class DocumentRetrievalRepository
    implements DocumentRetrievalRepositoryInterface
{
    constructor(private readonly database: DatabaseService) {}

    /**
     * Reads published, ready documents accessible to the given role.
     */
    async findAvailableForRole(
        role: string,
    ): Promise<RetrievableDocument[]> {
        return this.database.query<RetrievableDocument>(
            `
                SELECT
                    id AS "documentId",
                    indexing_generation AS "generationId",
                    title
                FROM documents
                WHERE status = 'published'
                  AND indexing_status = 'ready'
                  AND indexing_generation IS NOT NULL
                  AND indexed_at IS NOT NULL
                  AND $1::text = ANY(allowed_roles)
                ORDER BY id
            `,
            [role],
        );
    }

    /**
     * Rechecks access and returns current generations for selected IDs.
     */
    async findAvailableByIds(
        role: string,
        documentIds: string[],
    ): Promise<RetrievableDocument[]> {
        if (documentIds.length === 0) {
            return [];
        }

        return this.database.query<RetrievableDocument>(
            `
                SELECT
                    id AS "documentId",
                    indexing_generation AS "generationId",
                    title
                FROM documents
                WHERE id = ANY($2::uuid[])
                  AND status = 'published'
                  AND indexing_status = 'ready'
                  AND indexing_generation IS NOT NULL
                  AND indexed_at IS NOT NULL
                  AND $1::text = ANY(allowed_roles)
                ORDER BY id
            `,
            [role, documentIds],
        );
    }
}