import { z } from 'zod';

export const jwtPayloadSchema = z.object({
    sub: z.string().uuid(),
    iat: z.number().finite().int(),
    exp: z.number().finite().int(),
}).strict();
