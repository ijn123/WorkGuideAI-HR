import {
    BadRequestException,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    ParseUUIDPipe,
} from '@nestjs/common';
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
export class HrController {
    constructor(private readonly hrService: HrService) {}

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

        return this.hrService.getLeaveBalance(employeeId, year);
    }

    @Get('employees/:employeeId/requests')
    findRequestsByEmployeeId(
        @Param('employeeId', new ParseUUIDPipe({ version: '4' }))
        employeeId: string,
    ): Promise<HrRequestResponseDto[]> {
        return this.hrService.findRequestsByEmployeeId(employeeId);
    }

    @Get('employees/:employeeId/onboarding-tasks')
    findOnboardingTasksByEmployeeId(
        @Param('employeeId', new ParseUUIDPipe({ version: '4' }))
        employeeId: string,
    ): Promise<OnboardingTaskResponseDto[]> {
        return this.hrService.findOnboardingTasksByEmployeeId(
            employeeId,
        );
    }
}