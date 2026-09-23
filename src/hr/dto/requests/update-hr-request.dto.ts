import { z } from 'zod';
import { createHrRequestSchema } from './create-hr-request.dto';

export const updateHrRequestSchema = createHrRequestSchema
    .partial()
    .refine(
        (value) =>
            Object.values(value).some((item) => item !== undefined),
        {
            message: 'Укажите хотя бы одно поле для изменения.',
        },
    );

export type UpdateHrRequestDto = z.infer<
    typeof updateHrRequestSchema
>;