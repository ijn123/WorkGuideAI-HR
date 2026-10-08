import { z } from 'zod';

const hrOperationSchema = z.discriminatedUnion('operation', [
    z.object({
        operation: z.literal('LEAVE_BALANCE'),
        year: z.number().int().min(2000).max(2100),
    }).strict(),

    z.object({
        operation: z.literal('HR_REQUESTS'),
    }).strict(),

    z.object({
        operation: z.literal('ONBOARDING_TASKS'),
    }).strict(),
]);

const hrOperationsSchema = z.array(hrOperationSchema)
    .min(1)
    .max(3)
    .superRefine((operations, context) => {
        const names = operations.map((item) => item.operation);

        if (new Set(names).size !== names.length) {
            context.addIssue({
                code: 'custom',
                message: 'Each HR operation may appear only once.',
            });
        }
    });

export const questionRoutingSchema = z.discriminatedUnion('route', [
    z.object({
        route: z.literal('DOCUMENTS'),
    }).strict(),

    z.object({
        route: z.literal('SQL'),
        operations: hrOperationsSchema,
    }).strict(),

    z.object({
        route: z.literal('HYBRID'),
        operations: hrOperationsSchema,
    }).strict(),

    z.object({
        route: z.literal('CLARIFICATION'),
        question: z.string().trim().min(1).max(500),
    }).strict(),
]);

export type HrOperation = z.infer<typeof hrOperationSchema>;
export type QuestionRoutingDecision = z.infer<
    typeof questionRoutingSchema
>;