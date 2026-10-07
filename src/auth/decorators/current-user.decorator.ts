import {
    createParamDecorator,
    ExecutionContext,
    InternalServerErrorException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../types/authenticated-request';
import type { AuthenticatedUser } from '../types/authenticated-user';

export const CurrentUser = createParamDecorator(
    (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
        const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
        if (!request.user) {
            throw new InternalServerErrorException(
                'Authenticated user is unavailable. Ensure AuthGuard is applied.',
            );
        }
        return request.user;
    },
);
