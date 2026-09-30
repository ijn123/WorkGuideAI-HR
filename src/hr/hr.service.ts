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
import { OnboardingTaskStatus } from './entities/onboarding-task.entity';


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
            employeeId: balance.employeeId,
            year: balance.year,
            entitledDays: balance.entitledDays,
            usedDays: balance.usedDays,
            remainingDays: balance.remainingDays,
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
                employeeId: task.employeeId,
                title: task.title,
                status:
                    task.status === OnboardingTaskStatus.TODO
                        ? 'pending'
                        : task.status,
                dueDate: task.dueAt
                    ? task.dueAt.toISOString().slice(0, 10)
                    : null,
            }),
        );
    }
}
