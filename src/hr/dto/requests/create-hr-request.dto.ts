import { z } from 'zod';

export const createHrRequestSchema = z
    .object({
        subject: z.string().trim().min(1).max(200),
        description: z.string().trim().min(1).max(5000),
    })
    .strict();

export type CreateHrRequestDto = z.infer<
    typeof createHrRequestSchema
>;