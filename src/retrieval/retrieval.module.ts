import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from '../ai/ai.module';
import { DocumentsModule } from '../documents/documents.module';
import { VectorStorageModule } from '../vector-storage/vector-storage.module';
import { DocumentRetrievalService } from './document-retrieval.service';
import { DOCUMENT_RETRIEVAL } from './interfaces/document-retrieval.interface';

@Module({
    imports: [
        ConfigModule,
        AiModule,
        DocumentsModule,
        VectorStorageModule,
    ],
    providers: [
        {
            provide: DOCUMENT_RETRIEVAL,
            useClass: DocumentRetrievalService,
        },
    ],
    exports: [DOCUMENT_RETRIEVAL],
})
export class RetrievalModule {}