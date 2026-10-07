import {
    BadRequestException,
    Injectable,
    PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { extname } from 'node:path';
import { TxtExtractor } from './extractors/txt.extractor';
import { DocxExtractor } from './extractors/docx.extractor';
import { PdfExtractor } from './extractors/pdf.extractor';
import { ChunkingService } from './chunking.service';
import type { ExtractedDocument } from './types/extracted-document';
import type { DocumentChunk } from './types/document-chunk';

export interface PrepareDocumentInput {
    documentId: string;
    generationId: string;
    title: string;
    filename: string;
    buffer: Buffer;
}

@Injectable()
export class DocumentPreparationService {
    constructor(
        private readonly config: ConfigService,
        private readonly txtExtractor: TxtExtractor,
        private readonly docxExtractor: DocxExtractor,
        private readonly pdfExtractor: PdfExtractor,
        private readonly chunkingService: ChunkingService,
    ) {}

    /**
     * Извлекает текст файла и разбивает его на фрагменты.
     *
     * @remarks
     * Расширение выбирает экстрактор, но не подтверждает
     * подлинность формата файла.
     * Создание эмбеддингов и запись в БД выполняются отдельно.
     */
    async prepare(
        input: PrepareDocumentInput,
    ): Promise<DocumentChunk[]> {

        const maxFileSizeMb = this.config.getOrThrow<number>(
            'INGESTION_MAX_FILE_SIZE_MB',
        );
        const maxFileSizeBytes = maxFileSizeMb * 1024 * 1024;

        if (input.buffer.length > maxFileSizeBytes) {
            throw new PayloadTooLargeException(
                `Размер файла превышает ${maxFileSizeMb} МБ.`,
            );
        }
        if (input.buffer.length === 0) {
            throw new BadRequestException('Загруженный файл пуст.');
        }

        const extension = extname(input.filename).toLowerCase();
        let document: ExtractedDocument;

        switch (extension) {
            case '.txt':
                document = this.txtExtractor.extract(input.buffer);
                break;

            case '.docx':
                document = await this.docxExtractor.extract(input.buffer);
                break;

            case '.pdf':
                document = await this.pdfExtractor.extract(input.buffer);
                break;

            default:
                throw new BadRequestException(
                    'Поддерживаются только PDF, DOCX и TXT.',
                );
        }

        const chunks = this.chunkingService.chunk(
            {
                documentId: input.documentId,
                generationId: input.generationId,
                title: input.title,
                document,
            },
            {
                chunkSize: this.config.getOrThrow<number>(
                    'INGESTION_CHUNK_SIZE',
                ),
                chunkOverlap: this.config.getOrThrow<number>(
                    'INGESTION_CHUNK_OVERLAP',
                ),
            },
        );

        if (chunks.length === 0) {
            throw new BadRequestException(
                'Не удалось получить текстовые фрагменты документа.',
            );
        }

        return chunks;
    }
}