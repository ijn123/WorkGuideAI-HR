import { z } from 'zod';

const databaseEnvSchema = z.object({
    DB_HOST: z.string().trim().min(1),
    DB_PORT: z.coerce.number().int().min(1).max(65535),
    DB_NAME: z.string().trim().min(1),
    DB_USER: z.string().trim().min(1),
    DB_PASSWORD: z.string().min(1),
    INGESTION_CHUNK_SIZE: z.coerce.number().int().positive().default(1000),
    INGESTION_CHUNK_OVERLAP: z.coerce.number().int().nonnegative().default(200),
    GEMINI_EMBEDDING_MODEL: z.string().trim().min(1),
    GEMINI_EMBEDDING_DIMENSIONS: z.coerce
        .number()
        .int()
        .positive()
        .max(3072),
    QDRANT_URL: z.string().url(),
    QDRANT_COLLECTION: z.string().trim().min(1),
    QDRANT_API_KEY: z.string().trim().optional(),
    INGESTION_MAX_FILE_SIZE_MB: z.coerce
        .number()
        .int()
        .min(1)
        .max(50)
        .default(10),
    RETRIEVAL_TOP_K: z.coerce
        .number()
        .int()
        .min(1)
        .max(20)
        .default(5),

    RETRIEVAL_SCORE_THRESHOLD: z.coerce
        .number()
        .min(-1)
        .max(1)
        .default(0.65),

    RAG_MAX_CONTEXT_CHARS: z.coerce
        .number()
        .int()
        .min(1000)
        .max(50000)
        .default(12000),
}).refine(
    (config) =>
        config.INGESTION_CHUNK_OVERLAP < config.INGESTION_CHUNK_SIZE,
    {
        message: 'Перекрытие должно быть меньше размера фрагмента.',
        path: ['INGESTION_CHUNK_OVERLAP'],
    },
);

export function validateEnvironment(
    config: Record<string, unknown>,
): Record<string, unknown> {
    const result = databaseEnvSchema.safeParse(config);

    if (!result.success) {
        const fields = [
            ...new Set(
                result.error.issues.map((issue) => issue.path.join('.')),
            ),
        ];

        throw new Error(
            `Некорректные настройки окружения: ${fields.join(', ')}`,
        );
    }

    return {
        ...config,
        ...result.data,
    };
}
