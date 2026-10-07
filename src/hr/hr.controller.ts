import {
    Controller,
    ForbiddenException,
    Get,
    Param,
    UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { HrService } from './hr.service';
import {
    EmployeeRouteParamsDto,
    LeaveBalanceRouteParamsDto,
} from './dto/requests/hr-route-params.dto';
import type {
    HrRequestResponseDto,
} from './dto/responses/hr-request-response.dto';
import type {
    LeaveBalanceResponseDto,
} from './dto/responses/leave-balance-response.dto';
import type {
    OnboardingTaskResponseDto,
} from './dto/responses/onboarding-task-response.dto';

@Controller('hr')
@UseGuards(AuthGuard)
export class HrController {
    constructor(private readonly hrService: HrService) {}

    @Get('employees/:employeeId/leave-balance/:year')
    getLeaveBalance(
        @Param() params: LeaveBalanceRouteParamsDto,
        @CurrentUser() currentUser: AuthenticatedUser,
    ): Promise<LeaveBalanceResponseDto> {
        this.requireOwnership(params.employeeId, currentUser);
        return this.hrService.getLeaveBalance(
            currentUser.employeeId,
            Number(params.year),
        );
    }

    @Get('employees/:employeeId/requests')
    findRequestsByEmployeeId(
        @Param() params: EmployeeRouteParamsDto,
        @CurrentUser() currentUser: AuthenticatedUser,
    ): Promise<HrRequestResponseDto[]> {
        this.requireOwnership(params.employeeId, currentUser);
        return this.hrService.findRequestsByEmployeeId(currentUser.employeeId);
    }

    @Get('employees/:employeeId/onboarding-tasks')
    findOnboardingTasksByEmployeeId(
        @Param() params: EmployeeRouteParamsDto,
        @CurrentUser() currentUser: AuthenticatedUser,
    ): Promise<OnboardingTaskResponseDto[]> {
        this.requireOwnership(params.employeeId, currentUser);
        return this.hrService.findOnboardingTasksByEmployeeId(
            currentUser.employeeId,
        );
    }

    private requireOwnership(
        employeeId: string,
        currentUser: AuthenticatedUser,
    ): void {
        if (employeeId.toLowerCase() !== currentUser.employeeId.toLowerCase()) {
            throw new ForbiddenException();
        }
    }
}
