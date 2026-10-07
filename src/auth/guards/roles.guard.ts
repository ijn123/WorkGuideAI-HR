import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { EmployeeRole } from '../../employees/employee.entity';

type AuthenticatedUser = {
    id: string;
    role: EmployeeRole;
};

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<EmployeeRole[]>(
            ROLES_KEY,
            [context.getHandler(), context.getClass()],
        );

        if (!requiredRoles) {
            return true;
        }

        const request = context.switchToHttp().getRequest<{
            user?: AuthenticatedUser;
        }>();

        if (!request.user) {
            throw new UnauthorizedException();
        }

        return requiredRoles.includes(request.user.role);
    }
}
