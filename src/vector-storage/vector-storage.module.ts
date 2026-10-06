import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QdrantService } from './qdrant.service';
import { VECTOR_STORAGE } from './interfaces/vector-storage.interface';

@Module({
    imports: [ConfigModule],
    providers: [
        QdrantService,
        {
            provide: VECTOR_STORAGE,
            useExisting: QdrantService,
        },
    ],
    exports: [VECTOR_STORAGE, QdrantService],
})
export class VectorStorageModule {}
