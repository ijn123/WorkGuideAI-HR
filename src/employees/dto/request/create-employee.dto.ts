import { z } from 'zod';

export const createEmployeeSchema = z
    .object({
        firstName: z.string().trim().min(1).max(100),
        lastName: z.string().trim().min(1).max(100),
        workEmail: z.string().trim().email().max(254),
        department: z.string().trim().min(1).max(100),
    })
    .strict();

export type CreateEmployeeDto = z.infer<
    typeof createEmployeeSchema
>;