import {
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import {
    LEAVE_BALANCES_REPOSITORY,
    type LeaveBalancesRepositoryInterface,
} from './interfaces/leave-balances-repository.interface';
import {
    leaveBalanceResponseSchema,
    type LeaveBalanceResponseDto,
} from './dto/responses/leave-balance-response.dto';

@Injectable()
export class LeaveBalancesService {
    constructor(
        @Inject(LEAVE_BALANCES_REPOSITORY)
        private readonly repository: LeaveBalancesRepositoryInterface,
    ) {}

    /**
     * Получает баланс отпуска сотрудника за указанный год.
     *
     * @param employeeId - Идентификатор сотрудника.
     * @param year - Год, за который запрашивается баланс.
     * @returns Баланс с остатком, вычисленным доменной сущностью.
     * @throws {@link NotFoundException} Если запись отсутствует.
     *
     * @remarks
     * Отсутствие записи не означает нулевой остаток.
     * Вызывающий код должен обеспечить право пользователя
     * читать баланс указанного сотрудника.
     */
    async getLeaveBalance(
        employeeId: string,
        year: number,
    ): Promise<LeaveBalanceResponseDto> {
        const balance = await this.repository.findLeaveBalance(
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
}