import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import type {
    VectorizedChunk,
    VectorStorageInterface,
} from './interfaces/vector-storage.interface';
import type {
    VectorSearchInterface,
    VectorSearchInput,
    RetrievedChunk,
} from './interfaces/vector-search.interface';
import { chunkPayloadSchema } from './schemas/chunk-payload.schema';

@Injectable()
export class QdrantService
    implements VectorStorageInterface, VectorSearchInterface
{
    private readonly client: QdrantClient;
    private readonly collection: string;
    private readonly dimensions: number;

    constructor(config: ConfigService) {
        this.collection = config.getOrThrow<string>(
            'QDRANT_COLLECTION',
        );

        this.dimensions = config.getOrThrow<number>(
            'GEMINI_EMBEDDING_DIMENSIONS',
        );

        this.client = new QdrantClient({
            url: config.getOrThrow<string>('QDRANT_URL'),
            apiKey: config.get<string>('QDRANT_API_KEY') || undefined,
            timeout: 30_000,
        });
    }

    /**
     * Создаёт отсутствующую коллекцию и проверяет её конфигурацию.
     *
     * Существующая коллекция должна использовать один безымянный
     * вектор нужной размерности и метрику Cosine.
     * Несовместимая коллекция вызывает ошибку и не пересоздаётся.
     */
    async ensureCollection(): Promise<void> {
        const { exists } = await this.client.collectionExists(
            this.collection,
        );

        if (!exists) {
            try {
                await this.client.createCollection(this.collection, {
                    vectors: {
                        size: this.dimensions,
                        distance: 'Cosine',
                    },
                });
            } catch (error) {
                // Другой экземпляр приложения мог создать её параллельно.
                const current = await this.client.collectionExists(
                    this.collection,
                );

                if (!current.exists) {
                    throw error;
                }
            }
        }

        const info = await this.client.getCollection(this.collection);
        const vectors = info.config.params.vectors;

        if (
            !vectors ||
            !('size' in vectors) ||
            typeof vectors.size !== 'number' ||
            vectors.size !== this.dimensions ||
            vectors.distance !== 'Cosine'
        ) {
            throw new Error(
                `Коллекция "${this.collection}" должна иметь ` +
                `безымянные векторы размерности ${this.dimensions} ` +
                'и метрику Cosine.',
            );
        }
    }

    /**
     * Записывает фрагменты порциями по 64 точки.
     * Повторная запись тех же ID обновляет точки без дублирования.
     * При частичной ошибке выбрасывает исключение:
     * вызывающий сервис должен очистить неудачную генерацию.
     */
    async upsertChunks(chunks: VectorizedChunk[]): Promise<void> {
        for (const { vector } of chunks) {
            if (
                vector.length !== this.dimensions ||
                !vector.every((value) => Number.isFinite(value)) ||
                vector.every((value) => value === 0)
            ) {
                throw new Error(
                    'Некорректный вектор для записи в Qdrant.',
                );
            }
        }

        const batchSize = 64;

        for (let offset = 0; offset < chunks.length; offset += batchSize) {
            const batch = chunks.slice(offset, offset + batchSize);

            const result = await this.client.upsert(this.collection, {
                wait: true,
                points: batch.map(({ chunk, vector }) => ({
                    id: chunk.id,
                    vector,
                    payload: {
                        documentId: chunk.documentId,
                        generationId: chunk.generationId,
                        chunkId: chunk.id,
                        title: chunk.title,
                        text: chunk.text,
                        pageNumber: chunk.pageNumber,
                        chunkIndex: chunk.chunkIndex,
                    },
                })),
            });

            if (result.status !== 'completed') {
                throw new Error(
                    'Qdrant не подтвердил завершение записи фрагментов.',
                );
            }
        }
    }

    /**
     * Удаляет одну генерацию только указанного документа.
     */
    async deleteGeneration(
        documentId: string,
        generationId: string,
    ): Promise<void> {
        this.requireIdentifiers(documentId, generationId);

        const result = await this.client.delete(this.collection, {
            wait: true,
            filter: {
                must: [
                    {
                        key: 'documentId',
                        match: { value: documentId },
                    },
                    {
                        key: 'generationId',
                        match: { value: generationId },
                    },
                ],
            },
        });

        if (result.status !== 'completed') {
            throw new Error(
                'Qdrant не подтвердил удаление генерации.',
            );
        }
    }

    /**
     * Удаляет остальные генерации указанного документа.
     *
     * Вызывается после успешной записи новой генерации.
     * Вызывающий сервис должен исключить параллельную
     * индексацию одного документа на время этой операции.
     */
    async deleteOtherGenerations(
        documentId: string,
        generationId: string,
    ): Promise<void> {
        this.requireIdentifiers(documentId, generationId);

        const result = await this.client.delete(this.collection, {
            wait: true,
            filter: {
                must: [
                    {
                        key: 'documentId',
                        match: { value: documentId },
                    },
                ],
                must_not: [
                    {
                        key: 'generationId',
                        match: { value: generationId },
                    },
                ],
            },
        });

        if (result.status !== 'completed') {
            throw new Error(
                'Qdrant не подтвердил удаление старых генераций.',
            );
        }
    }

    private requireIdentifiers(
        documentId: string,
        generationId: string,
    ): void {
        if (!documentId?.trim() || !generationId?.trim()) {
            throw new Error(
                'Для удаления нужны documentId и generationId.',
            );
        }
    }
    /**
     * Searches allowed document generations before top-k selection.
     * Invalid payloads are excluded from the returned evidence.
     */
    async search(input: VectorSearchInput): Promise<RetrievedChunk[]> {
        if (input.allowedDocuments.length === 0) {
            return [];
        }

        if (
            input.vector.length !== this.dimensions ||
            !input.vector.every(Number.isFinite) ||
            input.vector.every((value) => value === 0)
        ) {
            throw new Error('Некорректный вектор поискового запроса.');
        }

        if (
            !Number.isInteger(input.limit) ||
            input.limit < 1 ||
            input.limit > 20 ||
            !Number.isFinite(input.scoreThreshold) ||
            input.scoreThreshold < -1 ||
            input.scoreThreshold > 1
        ) {
            throw new Error('Некорректные параметры поиска.');
        }

        const result = await this.client.query(this.collection, {
            query: input.vector,
            limit: input.limit,
            score_threshold: input.scoreThreshold,
            with_payload: true,
            with_vector: false,
            filter: {
                should: input.allowedDocuments.map((document) => ({
                    must: [
                        {
                            key: 'documentId',
                            match: { value: document.documentId },
                        },
                        {
                            key: 'generationId',
                            match: { value: document.generationId },
                        },
                    ],
                })),
            },
        });

        const chunks: RetrievedChunk[] = [];

        for (const point of result.points) {
            const parsed = chunkPayloadSchema.safeParse(point.payload);

            if (!parsed.success) {
                continue;
            }

            const payload = parsed.data;

            const allowed = input.allowedDocuments.some(
                (document) =>
                    document.documentId === payload.documentId &&
                    document.generationId === payload.generationId,
            );

            if (
                !allowed ||
                String(point.id) !== payload.chunkId ||
                !Number.isFinite(point.score) ||
                point.score < input.scoreThreshold
            ) {
                continue;
            }

            chunks.push({
                id: payload.chunkId,
                documentId: payload.documentId,
                generationId: payload.generationId,
                title: payload.title,
                text: payload.text,
                pageNumber: payload.pageNumber,
                chunkIndex: payload.chunkIndex,
                score: point.score,
            });
        }

        return chunks.sort((a, b) => b.score - a.score);
    }
}