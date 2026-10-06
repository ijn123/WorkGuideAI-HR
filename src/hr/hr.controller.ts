import {
    BadRequestException,
    Controller,
    ForbiddenException,
    Get,
    Param,
    ParseIntPipe,
    ParseUUIDPipe,
    UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { HrService } from './hr.service';
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
        @Param('employeeId', new ParseUUIDPipe({ version: '4' }))
        employeeId: string,
        @Param('year', ParseIntPipe)
        year: number,
        @CurrentUser() currentUser: AuthenticatedUser,
    ): Promise<LeaveBalanceResponseDto> {
        if (year < 2000 || year > 2100) {
            throw new BadRequestException(
                'Год должен быть в диапазоне от 2000 до 2100.',
            );
        }

        this.requireOwnership(employeeId, currentUser);
        return this.hrService.getLeaveBalance(currentUser.employeeId, year);
    }

    @Get('employees/:employeeId/requests')
    findRequestsByEmployeeId(
        @Param('employeeId', new ParseUUIDPipe({ version: '4' }))
        employeeId: string,
        @CurrentUser() currentUser: AuthenticatedUser,
    ): Promise<HrRequestResponseDto[]> {
        this.requireOwnership(employeeId, currentUser);
        return this.hrService.findRequestsByEmployeeId(currentUser.employeeId);
    }

    @Get('employees/:employeeId/onboarding-tasks')
    findOnboardingTasksByEmployeeId(
        @Param('employeeId', new ParseUUIDPipe({ version: '4' }))
        employeeId: string,
        @CurrentUser() currentUser: AuthenticatedUser,
    ): Promise<OnboardingTaskResponseDto[]> {
        this.requireOwnership(employeeId, currentUser);
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
