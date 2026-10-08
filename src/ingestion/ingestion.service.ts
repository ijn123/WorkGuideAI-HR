import {
    ConflictException,
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
    EMBEDDINGS,
    type EmbeddingsInterface,
} from '../ai/interfaces/embeddings.interface';
import {
    DOCUMENTS_REPOSITORY,
    type DocumentsRepositoryInterface,
} from '../documents/interfaces/documents-repository.interface';
import {
    VECTOR_STORAGE,
    type VectorStorageInterface,
    type VectorizedChunk,
} from '../vector-storage/interfaces/vector-storage.interface';
import { DocumentPreparationService } from './document-preparation.service';

export interface IndexDocumentInput {
    documentId: string;
    filename: string;
    buffer: Buffer;
}

export interface IndexDocumentResult {
    documentId: string;
    generationId: string;
    chunksCount: number;
}

@Injectable()
export class IngestionService {
    constructor(
        private readonly preparation: DocumentPreparationService,

        @Inject(EMBEDDINGS)
        private readonly embeddings: EmbeddingsInterface,

        @Inject(VECTOR_STORAGE)
        private readonly vectorStorage: VectorStorageInterface,

        @Inject(DOCUMENTS_REPOSITORY)
        private readonly documents: DocumentsRepositoryInterface,
    ) {}
    /**
     * Индексирует существующий документ.
     * Вызывающая сторона должна проверить право на индексацию.
     */
    async indexDocument(
        input: IndexDocumentInput,
    ): Promise<IndexDocumentResult> {
        const document = await this.documents.findById(input.documentId);

        if (!document) {
            throw new NotFoundException('Документ не найден.');
        }

        await this.vectorStorage.ensureCollection();

        const generationId = randomUUID();

        const started = await this.documents.tryStartIndexing(
            document.id,
            generationId,
        );

        if (!started) {
            throw new ConflictException(
                'Документ уже индексируется или больше не существует.',
            );
        }

        let chunksCount = 0;

        try {
            const chunks = await this.preparation.prepare({
                documentId: document.id,
                generationId,
                title: document.title,
                filename: input.filename,
                buffer: input.buffer,
            });

            const vectors = await this.embeddings.embedDocuments(
                chunks.map((chunk) => chunk.text),
            );
            if (vectors.length !== chunks.length) {
                throw new Error(
                    'Количество векторов не совпадает с числом фрагментов.',
                );
            }

            const vectorizedChunks: VectorizedChunk[] = chunks.map(
                (chunk, index) => {
                    const vector = vectors[index];

                    if (!vector) {
                        throw new Error(
                            'Для фрагмента отсутствует вектор.',
                        );
                    }

                    return { chunk, vector };
                },
            );

            await this.vectorStorage.upsertChunks(vectorizedChunks);

            await this.vectorStorage.deleteOtherGenerations(
                document.id,
                generationId,
            );

            chunksCount = chunks.length;
        } catch (error) {
            try {
                await this.vectorStorage.deleteGeneration(
                    document.id,
                    generationId,
                );

                const updated = await this.documents.markIndexingFailed(
                    document.id,
                    generationId,
                    'Не удалось завершить индексацию документа.',
                );

                if (!updated) {
                    throw new Error(
                        'Не удалось сохранить статус failed.',
                    );
                }
            } catch (cleanupError) {
                throw new AggregateError(
                    [error, cleanupError],
                    'Индексация завершилась ошибкой; требуется проверка состояния.',
                );
            }

            throw error;
        }
        // Если PostgreSQL выполнил UPDATE, но ответ потерялся,
        // удалять векторы нельзя. Поэтому этот шаг вне catch.
        const completed = await this.documents.markIndexingReady(
            document.id,
            generationId,
        );

        if (!completed) {
            throw new ConflictException(
                'Не удалось подтвердить завершение текущей индексации.',
            );
        }

        return {
            documentId: document.id,
            generationId,
            chunksCount,
        };
    }
}