import { z } from 'zod';

const databaseEnvSchema = z.object({
    DB_HOST: z.string().trim().min(1),
    DB_PORT: z.coerce.number().int().min(1).max(65535),
    DB_NAME: z.string().trim().min(1),
    DB_USER: z.string().trim().min(1),
    DB_PASSWORD: z.string().min(1),
});

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
            `Некорректные настройки базы данных: ${fields.join(', ')}`,
        );
    }

    return {
        ...config,
        ...result.data,
    };
}
