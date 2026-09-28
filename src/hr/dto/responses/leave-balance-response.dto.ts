import { z } from 'zod';

export const leaveBalanceResponseSchema = z.object({
    employeeId: z.string().uuid(),
    year: z.number().int().min(2000).max(2100),
    entitledDays: z.number().nonnegative(),
    usedDays: z.number().nonnegative(),
    remainingDays: z.number().nonnegative(),
});

export type LeaveBalanceResponseDto = z.infer<
    typeof leaveBalanceResponseSchema
>;