import { z } from 'zod';

export const groundedAnswerSchema = z.object({
    answer: z.string().trim().min(1).max(12000),
    insufficientInformation: z.boolean(),
    sourceIds: z.array(
        z.string().regex(/^S[1-9]\d*$/),
    ).max(20),
}).strict().superRefine((result, context) => {
    if (
        result.insufficientInformation &&
        result.sourceIds.length > 0
    ) {
        context.addIssue({
            code: 'custom',
            path: ['sourceIds'],
            message: 'An insufficient-information result must have no sources.',
        });
    }

    if (
        !result.insufficientInformation &&
        result.sourceIds.length === 0
    ) {
        context.addIssue({
            code: 'custom',
            path: ['sourceIds'],
            message: 'A supported answer must reference at least one source.',
        });
    }

    if (new Set(result.sourceIds).size !== result.sourceIds.length) {
        context.addIssue({
            code: 'custom',
            path: ['sourceIds'],
            message: 'Source IDs must be unique.',
        });
    }
});