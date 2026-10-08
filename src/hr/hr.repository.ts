import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
    toHrRequestEntity,
    type HrRequestRow,
} from './mappers/hr-request-entity.mapper';
import {
    toLeaveBalanceEntity,
    type LeaveBalanceRow,
} from './mappers/leave-balance-entity.mapper';
import {
    toOnboardingTaskEntity,
    type OnboardingTaskRow,
} from './mappers/onboarding-task-entity.mapper';
import type { HrRequest } from './entities/hr-request.entity';
import type { LeaveBalance } from './entities/leave-balance.entity';
import type { OnboardingTask } from './entities/onboarding-task.entity';
import type {
    HrRequestsRepositoryInterface,
} from './interfaces/hr-requests-repository.interface';
import type {
    LeaveBalancesRepositoryInterface,
} from './interfaces/leave-balances-repository.interface';
import type {
    OnboardingTasksRepositoryInterface,
} from './interfaces/onboarding-tasks-repository.interface';


@Injectable()
export class HrRepository
    implements
        HrRequestsRepositoryInterface,
        LeaveBalancesRepositoryInterface,
        OnboardingTasksRepositoryInterface
{

    constructor(private readonly database: DatabaseService) {}

    async findRequestsByEmployeeId(
        employeeId: string,
    ): Promise<HrRequest[]> {
        const rows = await this.database.query<HrRequestRow>(
            `
      SELECT
        id,
        employee_id,
        subject,
        description,
        status
      FROM hr_requests
      WHERE employee_id = $1
      ORDER BY created_at DESC, id
      LIMIT 100
    `,
            [employeeId],
        );

        return rows.map(toHrRequestEntity);
    }

    async findLeaveBalance(
        employeeId: string,
        year: number,
    ): Promise<LeaveBalance | null> {
        const rows = await this.database.query<LeaveBalanceRow>(
            `
                SELECT
                    id,
                    employee_id,
                    year,
                    entitled_days,
                    used_days
                FROM leave_balances
                WHERE employee_id = $1
                  AND year = $2
            `,
            [employeeId, year],
        );

        const row = rows[0];

        return row ? toLeaveBalanceEntity(row) : null;
    }

    async findOnboardingTasksByEmployeeId(
        employeeId: string,
    ): Promise<OnboardingTask[]> {
        const rows = await this.database.query<OnboardingTaskRow>(
            `
      SELECT
        id,
        employee_id,
        title,
        status,
        to_char(due_date, 'YYYY-MM-DD') AS due_date,
        completed_at
      FROM onboarding_tasks
      WHERE employee_id = $1
      ORDER BY onboarding_tasks.due_date ASC NULLS LAST, id
      LIMIT 100
    `,
            [employeeId],
        );

        return rows.map(toOnboardingTaskEntity);
    }
}
