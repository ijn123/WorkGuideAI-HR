import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JsonWebTokenError, JwtService } from '@nestjs/jwt';
import { EmploymentStatus } from '../../employees/employee.entity';
import { AuthRepository } from '../auth.repository';
import { jwtPayloadSchema } from '../schemas/jwt-payload.schema';
import type { AuthenticatedRequest } from '../types/authenticated-request';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private readonly jwtService: JwtService,
        private readonly config: ConfigService,
        private readonly repository: AuthRepository,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
        delete request.user;

        const authorization = request.headers.authorization;
        const authorizationCount = request.rawHeaders?.filter(
            (value, index) => index % 2 === 0 && value.toLowerCase() === 'authorization',
        ).length;
        const match = typeof authorization === 'string'
            ? /^Bearer ([^\s,]+)$/.exec(authorization)
            : null;

        if (
            !match
            || match[0] !== authorization
            || (authorizationCount !== undefined && authorizationCount > 1)
        ) {
            throw new UnauthorizedException();
        }

        const secret = this.config.getOrThrow<string>('JWT_SECRET');
        let verifiedPayload: unknown;

        try {
            verifiedPayload = await this.jwtService.verifyAsync<object>(match[1], {
                secret,
                algorithms: ['HS256'],
                ignoreExpiration: false,
            });
        } catch (error: unknown) {
            // The underlying verifier accesses nbf before rejecting a null payload.
            const nullPayloadError = error instanceof TypeError
                && error.message === "Cannot read properties of null (reading 'nbf')";
            // Malformed JWT JSON can produce SyntaxError in the underlying decoder.
            if (
                error instanceof JsonWebTokenError
                || error instanceof SyntaxError
                || nullPayloadError
            ) {
                throw new UnauthorizedException();
            }
            throw error;
        }

        const payload = jwtPayloadSchema.safeParse(verifiedPayload);
        if (!payload.success) {
            throw new UnauthorizedException();
        }

        const employee = await this.repository.findAuthenticatedEmployeeById(
            payload.data.sub,
        );
        if (!employee || employee.employmentStatus !== EmploymentStatus.ACTIVE) {
            throw new UnauthorizedException();
        }

        request.user = { employeeId: employee.id };
        return true;
    }
}
