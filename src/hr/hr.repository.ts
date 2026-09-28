import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface HrRequestRow {
    id: string;
    subject: string;
    status: 'pending' | 'approved' | 'rejected';
}

export interface LeaveBalanceRow {
    employee_id: string;
    year: number;
    entitled_days: string;
    used_days: string;
    remaining_days: string;
}

export interface OnboardingTaskRow {
    id: string;
    employee_id: string;
    title: string;
    status: 'pending' | 'in_progress' | 'completed';
    due_date: string | null;
}

@Injectable()
export class HrRepository {
    constructor(private readonly database: DatabaseService) {
    }

    async findRequestsByEmployeeId(
        employeeId: string,
    ): Promise<HrRequestRow[]> {
        return this.database.query<HrRequestRow>(
            `
                SELECT id,
                       subject,
                       status
                FROM hr_requests
                WHERE employee_id = $1
                ORDER BY created_at DESC, id LIMIT 100
            `,
            [employeeId],
        );
    }

    async findLeaveBalance(
        employeeId: string,
        year: number,
    ): Promise<LeaveBalanceRow | null> {
        const rows = await this.database.query<LeaveBalanceRow>(
            `
      SELECT
        employee_id,
        year,
        entitled_days,
        used_days,
        entitled_days - used_days AS remaining_days
      FROM leave_balances
      WHERE employee_id = $1
        AND year = $2
    `,
            [employeeId, year],
        );

        return rows[0] ?? null;
    }

    async findOnboardingTasksByEmployeeId(
        employeeId: string,
    ): Promise<OnboardingTaskRow[]> {
        return this.database.query<OnboardingTaskRow>(
            `
      SELECT
        id,
        employee_id,
        title,
        status,
        to_char(due_date, 'YYYY-MM-DD') AS due_date
      FROM onboarding_tasks
      WHERE employee_id = $1
      ORDER BY due_date ASC NULLS LAST, id
      LIMIT 100
    `,
            [employeeId],
        );
    }
}
