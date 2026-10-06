import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DocumentsRepository } from './documents.repository';
import { DocumentsService } from './documents.service';
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
    ],
    exports: [DocumentsService, DOCUMENTS_REPOSITORY],
})
export class DocumentsModule {}
