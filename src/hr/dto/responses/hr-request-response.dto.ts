import { z } from 'zod';

export const hrRequestResponseSchema = z.object({
    id: z.string().min(1),
    subject: z.string().trim().min(1).max(200),
    status: z.enum(['pending', 'approved', 'rejected']),
});

export type HrRequestResponseDto = z.infer<
    typeof hrRequestResponseSchema
>;