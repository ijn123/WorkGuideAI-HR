import { z } from 'zod';

const environmentSchema = z.object({
    DB_HOST: z.string().trim().min(1),
    DB_PORT: z.coerce.number().int().min(1).max(65535),
    DB_NAME: z.string().trim().min(1),
    DB_USER: z.string().trim().min(1),
    DB_PASSWORD: z.string().min(1),
    JWT_SECRET: z.string().min(32).refine(
        (value) => value.trim().length > 0,
        { message: 'JWT_SECRET must not contain only whitespace' },
    ),
    JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive(),
});

export function validateEnvironment(
    config: Record<string, unknown>,
): Record<string, unknown> {
    const result = environmentSchema.safeParse(config);

    if (!result.success) {
        const fields = [
            ...new Set(
                result.error.issues.map((issue) => issue.path.join('.')),
            ),
        ];

        throw new Error(
            `Invalid environment configuration: ${fields.join(', ')}`,
        );
    }

    return {
        ...config,
        ...result.data,
    };
}
