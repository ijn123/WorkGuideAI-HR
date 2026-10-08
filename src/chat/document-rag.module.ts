import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from '../ai/ai.module';
import { DocumentsModule } from '../documents/documents.module';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { DocumentRagService } from './document-rag.service';
import { DOCUMENT_RAG } from './interfaces/document-rag.interface';

@Module({
    imports: [
        ConfigModule,
        AiModule,
        DocumentsModule,
        RetrievalModule,
    ],
    providers: [
        {
            provide: DOCUMENT_RAG,
            useClass: DocumentRagService,
        },
    ],
    exports: [DOCUMENT_RAG],
})
export class DocumentRagModule {}