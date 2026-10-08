import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import type { LeaveBalanceResponseDto } from '../../hr/dto/responses/leave-balance-response.dto';
import type { HrRequestResponseDto } from '../../hr/dto/responses/hr-request-response.dto';
import type { OnboardingTaskResponseDto } from '../../hr/dto/responses/onboarding-task-response.dto';
import type { HrOperation } from '../schemas/question-routing.schema';

export const HR_OPERATION_EXECUTOR = Symbol('HR_OPERATION_EXECUTOR');

export type HrOperationResult =
    | {
    operation: 'LEAVE_BALANCE';
    status: 'SUCCESS';
    data: LeaveBalanceResponseDto;
}
    | {
    operation: 'HR_REQUESTS';
    status: 'SUCCESS';
    data: HrRequestResponseDto[];
}
    | {
    operation: 'ONBOARDING_TASKS';
    status: 'SUCCESS';
    data: OnboardingTaskResponseDto[];
}
    | {
    operation: 'LEAVE_BALANCE';
    status: 'NOT_FOUND';
    year: number;
}
    | {
    operation: HrOperation['operation'];
    status: 'UNAVAILABLE';
};

export interface HrOperationExecutorInterface {
    /**
     * Executes an allowed operation for the authenticated employee.
     * User identity must come from verified authentication.
     *
     * Empty lists are successful results.
     * Missing leave balances are distinct from infrastructure failures.
     * Unexpected errors propagate to the caller.
     */
    execute(
        operation: HrOperation,
        user: AuthenticatedUser,
    ): Promise<HrOperationResult>;
}