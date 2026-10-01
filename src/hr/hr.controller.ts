import {
    BadRequestException,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    ParseUUIDPipe,
} from '@nestjs/common';
import { OnboardingTasksService } from './onboarding-tasks.service';
import type {
    HrRequestResponseDto,
} from './dto/responses/hr-request-response.dto';
import type {
    LeaveBalanceResponseDto,
} from './dto/responses/leave-balance-response.dto';
import type {
    OnboardingTaskResponseDto,
} from './dto/responses/onboarding-task-response.dto';
import { HrRequestsService } from './hr-requests.service';
import { LeaveBalancesService } from './leave-balances.service';


@Controller('hr')
export class HrController {
    constructor(
        private readonly hrRequestsService: HrRequestsService,
        private readonly leaveBalancesService: LeaveBalancesService,
        private readonly onboardingTasksService: OnboardingTasksService,
    ) {}

    @Get('employees/:employeeId/leave-balance/:year')
    getLeaveBalance(
        @Param('employeeId', new ParseUUIDPipe({ version: '4' }))
        employeeId: string,
        @Param('year', ParseIntPipe)
        year: number,
    ): Promise<LeaveBalanceResponseDto> {
        if (year < 2000 || year > 2100) {
            throw new BadRequestException(
                'Год должен быть в диапазоне от 2000 до 2100.',
            );
        }

        return this.leaveBalancesService.getLeaveBalance(employeeId, year);
    }

    @Get('employees/:employeeId/requests')
    findRequestsByEmployeeId(
        @Param('employeeId', new ParseUUIDPipe({ version: '4' }))
        employeeId: string,
    ): Promise<HrRequestResponseDto[]> {
        return this.hrRequestsService.findRequestsByEmployeeId(employeeId);
    }

    @Get('employees/:employeeId/onboarding-tasks')
    findOnboardingTasksByEmployeeId(
        @Param('employeeId', new ParseUUIDPipe({ version: '4' }))
        employeeId: string,
    ): Promise<OnboardingTaskResponseDto[]> {
        return this.onboardingTasksService.findOnboardingTasksByEmployeeId(
            employeeId,
        );
    }
}