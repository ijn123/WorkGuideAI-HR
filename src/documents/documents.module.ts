import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DocumentsRepository } from './documents.repository';
import { DocumentsService } from './documents.service';
import { DocumentRetrievalRepository } from './document-retrieval.repository';
import { DOCUMENT_RETRIEVAL_REPOSITORY } from './interfaces/document-retrieval-repository.interface';
import {
    DOCUMENTS_REPOSITORY,
} from './interfaces/documents-repository.interface';

@Module({
    imports: [DatabaseModule],
    providers: [
        DocumentsService,
        {
            provide: DOCUMENTS_REPOSITORY,
            useClass: DocumentsRepository,
        },
        {
            provide: DOCUMENT_RETRIEVAL_REPOSITORY,
            useClass: DocumentRetrievalRepository,
        },
    ],
    exports: [
        DocumentsService,
        DOCUMENTS_REPOSITORY,
        DOCUMENT_RETRIEVAL_REPOSITORY,
    ],
})
export class DocumentsModule {}
