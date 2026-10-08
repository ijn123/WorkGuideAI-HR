import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QdrantService } from './qdrant.service';
import { VECTOR_STORAGE } from './interfaces/vector-storage.interface';
import { VECTOR_SEARCH } from './interfaces/vector-search.interface';

@Module({
    imports: [ConfigModule],
    providers: [
        QdrantService,
        {
            provide: VECTOR_STORAGE,
            useExisting: QdrantService,
        },
        {
            provide: VECTOR_SEARCH,
            useExisting: QdrantService,
        },
    ],
    exports: [
        VECTOR_STORAGE,
        VECTOR_SEARCH,
        QdrantService,
    ],
})
export class VectorStorageModule {}
