import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { Document } from './document.entity';
import {
    toDocumentEntity,
    type DocumentRow,
} from './mappers/document-entity.mapper';

@Injectable()
export class DocumentsRepository {
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
}