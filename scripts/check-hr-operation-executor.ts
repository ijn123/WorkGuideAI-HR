import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import {
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { HrOperationExecutorService } from '../src/chat/hr-operation-executor.service';
import { LeaveBalancesService } from '../src/hr/leave-balances.service';
import { HrRequestsService } from '../src/hr/hr-requests.service';
import { OnboardingTasksService } from '../src/hr/onboarding-tasks.service';
import type { AuthenticatedUser } from '../src/auth/types/authenticated-user';
import type { HrOperation } from '../src/chat/schemas/question-routing.schema';

async function main(): Promise<void> {
    const employeeId = '10000000-0000-4000-8000-000000000001';
    const calls: string[] = [];
    let leaveError: Error = new NotFoundException();
    let requestsError: Error | undefined;

    const leaveBalances = new LeaveBalancesService({
        findLeaveBalance: async (id, year) => {
            calls.push(id);
            assert.equal(year, 2026);
            throw leaveError;
        },
    });

    const requests = new HrRequestsService({
        findRequestsByEmployeeId: async (id) => {
            calls.push(id);

            if (requestsError) {
                throw requestsError;
            }

            return [];
        },
    });

    const onboarding = new OnboardingTasksService({
        findOnboardingTasksByEmployeeId: async (id) => {
            calls.push(id);
            return [];
        },
    });

    const executor = new HrOperationExecutorService(
        leaveBalances,
        requests,
        onboarding,
    );

    // Only employeeId is used by this executor.
    // The role is deliberately omitted from this isolated test fixture.
    const user = { employeeId } as AuthenticatedUser;

    const emptyRequests = await executor.execute(
        { operation: 'HR_REQUESTS' },
        user,
    );

    assert.deepEqual(emptyRequests, {
        operation: 'HR_REQUESTS',
        status: 'SUCCESS',
        data: [],
    });

    const emptyTasks = await executor.execute(
        { operation: 'ONBOARDING_TASKS' },
        user,
    );

    assert.deepEqual(emptyTasks, {
        operation: 'ONBOARDING_TASKS',
        status: 'SUCCESS',
        data: [],
    });

    console.log('Пустые списки — успешный результат: OK');

    const missingBalance = await executor.execute(
        { operation: 'LEAVE_BALANCE', year: 2026 },
        user,
    );

    assert.deepEqual(missingBalance, {
        operation: 'LEAVE_BALANCE',
        status: 'NOT_FOUND',
        year: 2026,
    });

    console.log('Отсутствующий баланс — NOT_FOUND: OK');

    leaveError = new ServiceUnavailableException();

    const unavailableBalance = await executor.execute(
        { operation: 'LEAVE_BALANCE', year: 2026 },
        user,
    );

    assert.deepEqual(unavailableBalance, {
        operation: 'LEAVE_BALANCE',
        status: 'UNAVAILABLE',
    });

    requestsError = new ServiceUnavailableException();

    assert.deepEqual(
        await executor.execute({ operation: 'HR_REQUESTS' }, user),
        {
            operation: 'HR_REQUESTS',
            status: 'UNAVAILABLE',
        },
    );

    console.log('Недоступность источника — UNAVAILABLE: OK');

    requestsError = new Error('Unexpected test failure');

    await assert.rejects(
        () => executor.execute({ operation: 'HR_REQUESTS' }, user),
        (error: unknown) => error === requestsError,
    );

    console.log('Неожиданная ошибка передаётся выше: OK');

    const callsBeforeInvalidInput = calls.length;

    // Deliberately bypass TypeScript to verify runtime validation.
    const invalidOperations = [
        {
            operation: 'HR_REQUESTS',
            employeeId: '10000000-0000-4000-8000-000000000002',
        },
        {
            operation: 'EXECUTE_SQL',
            sql: 'SELECT * FROM employees',
        },
        {
            operation: 'LEAVE_BALANCE',
            year: 1999,
        },
    ];

    for (const operation of invalidOperations) {
        await assert.rejects(() =>
            executor.execute(operation as unknown as HrOperation, user),
        );
    }

    assert.equal(calls.length, callsBeforeInvalidInput);
    console.log('Недопустимые операции не вызывают сервисы: OK');

    assert.ok(calls.length > 0);
    assert.ok(calls.every((id) => id === employeeId));
    console.log('Все запросы используют ID проверенного пользователя: OK');
}

main().catch((error: unknown) => {
    console.error(
        'Ошибка проверки:',
        error instanceof Error ? error.message : 'Неизвестная ошибка',
    );
    process.exitCode = 1;
});