import { z } from 'zod';
import { createEmployeeSchema } from './create-employee.dto';

export const updateEmployeeSchema = createEmployeeSchema
    .partial()
    .refine(
        (value) =>
            Object.values(value).some((item) => item !== undefined),
        {
            message: 'Укажите хотя бы одно поле для изменения.',
        },
    );

export type UpdateEmployeeDto = z.infer<
    typeof updateEmployeeSchema
>;