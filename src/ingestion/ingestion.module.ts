import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DocumentPreparationService } from './document-preparation.service';
import { ChunkingService } from './chunking.service';
import { TxtExtractor } from './extractors/txt.extractor';
import { DocxExtractor } from './extractors/docx.extractor';
import { PdfExtractor } from './extractors/pdf.extractor';
import { AiModule } from '../ai/ai.module';
import { DocumentsModule } from '../documents/documents.module';
import { VectorStorageModule } from '../vector-storage/vector-storage.module';
import { IngestionService } from './ingestion.service';

@Module({
    imports: [ConfigModule, AiModule, DocumentsModule, VectorStorageModule,],
    providers: [
        DocumentPreparationService,
        ChunkingService,
        TxtExtractor,
        DocxExtractor,
        PdfExtractor,
        IngestionService,
    ],
    exports: [DocumentPreparationService, IngestionService,],
})
export class IngestionModule {}
