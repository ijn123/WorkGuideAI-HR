import { z } from 'zod';

export const chunkPayloadSchema = z.object({
    documentId: z.string().uuid(),
    generationId: z.string().uuid(),
    chunkId: z.string().uuid(),
    title: z.string().trim().min(1),
    text: z.string().trim().min(1),
    pageNumber: z.number().int().positive().nullable(),
    chunkIndex: z.number().int().nonnegative(),
});

export type ChunkPayload = z.infer<typeof chunkPayloadSchema>;
