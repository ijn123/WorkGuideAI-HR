import { z } from 'zod';

export const onboardingTaskResponseSchema = z.object({
    id: z.string().uuid(),
    employeeId: z.string().uuid(),
    title: z.string().min(1).max(200),
    status: z.enum([
        'pending',
        'in_progress',
        'completed',
        'cancelled',
    ]),
    dueDate: z.iso.date().nullable(),
});

export type OnboardingTaskResponseDto = z.infer<
    typeof onboardingTaskResponseSchema
>;