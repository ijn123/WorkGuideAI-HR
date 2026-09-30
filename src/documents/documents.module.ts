import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DocumentsRepository } from './documents.repository';

@Module({
    imports: [DatabaseModule],
    providers: [DocumentsRepository],
    exports: [DocumentsRepository],
})
export class DocumentsModule {}
