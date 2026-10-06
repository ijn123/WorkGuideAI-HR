import { z } from 'zod';

export const loginSchema = z
    .object({
        workEmail: z.string().trim().toLowerCase().email().max(254),
        password: z.string().min(1).refine(
            (value) => Buffer.byteLength(value, 'utf8') <= 1024,
            { message: 'Password must not exceed 1024 UTF-8 bytes.' },
        ),
    })
    .strict();

export type LoginDto = z.infer<typeof loginSchema>;
