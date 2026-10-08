import {
    Injectable,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { LeaveBalancesService } from '../hr/leave-balances.service';
import { HrRequestsService } from '../hr/hr-requests.service';
import { OnboardingTasksService } from '../hr/onboarding-tasks.service';
import {
    questionRoutingSchema,
    type HrOperation,
} from './schemas/question-routing.schema';
import type {
    HrOperationExecutorInterface,
    HrOperationResult,
} from './interfaces/hr-operation-executor.interface';

@Injectable()
export class HrOperationExecutorService
    implements HrOperationExecutorInterface
{
    constructor(
        private readonly leaveBalances: LeaveBalancesService,
        private readonly hrRequests: HrRequestsService,
        private readonly onboardingTasks: OnboardingTasksService,
    ) {}

    /**
     * Executes a validated operation using only authenticated identity.
     * Never accepts employee identity from the routing decision.
     */
    async execute(
        operation: HrOperation,
        user: AuthenticatedUser,
    ): Promise<HrOperationResult> {
        const decision = questionRoutingSchema.parse({
            route: 'SQL',
            operations: [operation],
        });

        if (decision.route !== 'SQL') {
            throw new Error('Unexpected routing decision.');
        }

        const validatedOperation = decision.operations[0];

        if (!validatedOperation) {
            throw new Error('Missing HR operation.');
        }

        try {
            switch (validatedOperation.operation) {
                case 'LEAVE_BALANCE':
                    return {
                        operation: 'LEAVE_BALANCE',
                        status: 'SUCCESS',
                        data: await this.leaveBalances.getLeaveBalance(
                            user.employeeId,
                            validatedOperation.year,
                        ),
                    };

                case 'HR_REQUESTS':
                    return {
                        operation: 'HR_REQUESTS',
                        status: 'SUCCESS',
                        data: await this.hrRequests.findRequestsByEmployeeId(
                            user.employeeId,
                        ),
                    };

                case 'ONBOARDING_TASKS':
                    return {
                        operation: 'ONBOARDING_TASKS',
                        status: 'SUCCESS',
                        data: await this.onboardingTasks
                            .findOnboardingTasksByEmployeeId(user.employeeId),
                    };
            }        } catch (error: unknown) {
            if (
                validatedOperation.operation === 'LEAVE_BALANCE' &&
                error instanceof NotFoundException
            ) {
                return {
                    operation: 'LEAVE_BALANCE',
                    status: 'NOT_FOUND',
                    year: validatedOperation.year,
                };
            }

            if (error instanceof ServiceUnavailableException) {
                return {
                    operation: validatedOperation.operation,
                    status: 'UNAVAILABLE',
                };
            }

            // Preserve unexpected errors and authorization failures.
            throw error;
        }

        throw new Error('Unsupported HR operation.');
    }
}