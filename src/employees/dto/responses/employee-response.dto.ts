import { z } from 'zod';

export const employeeResponseSchema = z.object({
    id: z.string().min(1),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    workEmail: z.string().trim().email().max(254),
    department: z.string().trim().min(1).max(100),
});

export type EmployeeResponseDto = z.infer<
    typeof employeeResponseSchema
>;