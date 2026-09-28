import { Injectable, NotFoundException } from '@nestjs/common';
import { HrRepository } from './hr.repository';
import { toHrRequestResponse } from './mappers/hr-request-response.mapper';
import {
    leaveBalanceResponseSchema,
    type LeaveBalanceResponseDto,
} from './dto/responses/leave-balance-response.dto';
import {
    onboardingTaskResponseSchema,
    type OnboardingTaskResponseDto,
} from './dto/responses/onboarding-task-response.dto';
import type {
    HrRequestResponseDto,
} from './dto/responses/hr-request-response.dto';


@Injectable()
export class HrService {
    constructor(private readonly hrRepository: HrRepository) {}

    async findRequestsByEmployeeId(
        employeeId: string,
    ): Promise<HrRequestResponseDto[]> {
        const requests =
            await this.hrRepository.findRequestsByEmployeeId(employeeId);

        return requests.map((request) =>
            toHrRequestResponse({
                id: request.id,
                subject: request.subject,
                status: request.status,
            }),
        );
    }

    async getLeaveBalance(
        employeeId: string,
        year: number,
    ): Promise<LeaveBalanceResponseDto> {
        const balance = await this.hrRepository.findLeaveBalance(
            employeeId,
            year,
        );

        if (!balance) {
            throw new NotFoundException(
                'Баланс отпуска за указанный год не найден.',
            );
        }

        return leaveBalanceResponseSchema.parse({
            employeeId: balance.employee_id,
            year: balance.year,
            entitledDays: Number(balance.entitled_days),
            usedDays: Number(balance.used_days),
            remainingDays: Number(balance.remaining_days),
        });
    }

    async findOnboardingTasksByEmployeeId(
        employeeId: string,
    ): Promise<OnboardingTaskResponseDto[]> {
        const tasks =
            await this.hrRepository.findOnboardingTasksByEmployeeId(
                employeeId,
            );

        return tasks.map((task) =>
            onboardingTaskResponseSchema.parse({
                id: task.id,
                employeeId: task.employee_id,
                title: task.title,
                status: task.status,
                dueDate: task.due_date,
            }),
        );
    }
}
