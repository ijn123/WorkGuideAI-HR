import type { LeaveBalance } from '../entities/leave-balance.entity';

export const LEAVE_BALANCES_REPOSITORY = Symbol(
    'LEAVE_BALANCES_REPOSITORY',
);

export interface LeaveBalancesRepositoryInterface {
    /**
     * Находит баланс отпуска сотрудника за указанный год.
     *
     * @returns Баланс отпуска или null, если запись отсутствует.
     */
    findLeaveBalance(
        employeeId: string,
        year: number,
    ): Promise<LeaveBalance | null>;
}