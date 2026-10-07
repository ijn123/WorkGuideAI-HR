import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { ExtractedDocument } from './types/extracted-document';
import type { DocumentChunk } from './types/document-chunk';

export interface ChunkingOptions {
    chunkSize: number;
    chunkOverlap: number;
}

export interface ChunkDocumentInput {
    documentId: string;
    generationId: string;
    title: string;
    document: ExtractedDocument;
}

@Injectable()
export class ChunkingService {
    /**
     * Разбивает текст на фрагменты, сохраняя исходные страницы.
     *
     * @remarks
     * Размер и перекрытие измеряются в символах Unicode,
     * а не в токенах модели.
     * Фрагменты не пересекают границы частей документа.
     */
    chunk(
        input: ChunkDocumentInput,
        options: ChunkingOptions,
    ): DocumentChunk[] {
        const { chunkSize, chunkOverlap } = options;

        if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
            throw new Error('chunkSize должен быть положительным целым числом.');
        }

        if (
            !Number.isInteger(chunkOverlap) ||
            chunkOverlap < 0 ||
            chunkOverlap >= chunkSize
        ) {
            throw new Error(
                'chunkOverlap должен быть целым числом от 0 до chunkSize - 1.',
            );
        }

        const chunks: DocumentChunk[] = [];
        const step = chunkSize - chunkOverlap;

        for (const part of input.document.parts) {
            const characters = Array.from(part.text.trim());

            for (let start = 0; start < characters.length; start += step) {
                const end = Math.min(start + chunkSize, characters.length);
                const text = characters.slice(start, end).join('').trim();

                if (text.length > 0) {
                    chunks.push({
                        id: randomUUID(),
                        documentId: input.documentId,
                        generationId: input.generationId,
                        title: input.title,
                        text,
                        pageNumber: part.pageNumber,
                        chunkIndex: chunks.length,
                    });
                }

                if (end === characters.length) {
                    break;
                }
            }
        }

        return chunks;
    }
}