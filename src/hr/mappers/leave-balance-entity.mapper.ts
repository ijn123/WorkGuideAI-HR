import { LeaveBalance } from '../entities/leave-balance.entity';

export interface LeaveBalanceRow {
    id: string;
    employee_id: string;
    year: number;
    entitled_days: string;
    used_days: string;
}

export function toLeaveBalanceEntity(
    row: LeaveBalanceRow,
): LeaveBalance {
    return new LeaveBalance({
        id: row.id,
        employeeId: row.employee_id,
        year: row.year,
        entitledDays: Number(row.entitled_days),
        usedDays: Number(row.used_days),
    });
}