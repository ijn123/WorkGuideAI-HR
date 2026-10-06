import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import type { EmbeddingsInterface } from './interfaces/embeddings.interface';

@Injectable()
export class EmbeddingsService implements EmbeddingsInterface {
    private readonly model: GoogleGenerativeAIEmbeddings;
    private readonly dimensions: number;

    constructor(config: ConfigService) {
        this.dimensions = config.getOrThrow<number>(
            'GEMINI_EMBEDDING_DIMENSIONS',
        );

        this.model = new GoogleGenerativeAIEmbeddings({
            apiKey: config.getOrThrow<string>('GEMINI_API_KEY'),
            model: config.getOrThrow<string>('GEMINI_EMBEDDING_MODEL'),
            outputDimensionality: this.dimensions,
            maxRetries: 2,
            maxConcurrency: 2,
        });
    }

    /**
     * Генерирует эмбеддинги в порядке переданных текстов.
     *
     * Проверяет количество, размерность и числовые значения векторов.
     * При ошибке выбрасывает исключение, чтобы индексация
     * не могла завершиться со статусом ready.
     */
    async embedDocuments(texts: string[]): Promise<number[][]> {
        if (texts.length === 0) {
            return [];
        }

        if (texts.some((text) => text.trim().length === 0)) {
            throw new Error(
                'Нельзя создать эмбеддинг для пустого текста.',
            );
        }

        const vectors = await this.model.embedDocuments(texts);

        if (vectors.length !== texts.length) {
            throw new Error(
                'Количество эмбеддингов не совпадает с количеством текстов.',
            );
        }

        for (const vector of vectors) {
            if (vector.length !== this.dimensions) {
                throw new Error(
                    'Размерность эмбеддинга не совпадает с настройками.',
                );
            }

            if (
                !vector.every((value) => Number.isFinite(value)) ||
                vector.every((value) => value === 0)
            ) {
                throw new Error(
                    'Модель вернула некорректный вектор.',
                );
            }
        }

        return vectors;
    }
}
