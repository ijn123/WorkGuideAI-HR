import {
    OnboardingTask,
    OnboardingTaskStatus,
} from '../entities/onboarding-task.entity';

type OnboardingTaskDbStatus =
    | 'pending'
    | 'in_progress'
    | 'completed'
    | 'cancelled';

export interface OnboardingTaskRow {
    id: string;
    employee_id: string;
    title: string;
    status: OnboardingTaskDbStatus;
    due_date: string | null;
    completed_at: Date | null;
}

const statusMapping: Record<
    OnboardingTaskDbStatus,
    OnboardingTaskStatus
> = {
    pending: OnboardingTaskStatus.TODO,
    in_progress: OnboardingTaskStatus.IN_PROGRESS,
    completed: OnboardingTaskStatus.COMPLETED,
    cancelled: OnboardingTaskStatus.CANCELLED,
};

export function toOnboardingTaskEntity(
    row: OnboardingTaskRow,
): OnboardingTask {
    return new OnboardingTask({
        id: row.id,
        employeeId: row.employee_id,
        title: row.title,
        status: statusMapping[row.status],
        dueAt: row.due_date
            ? new Date(`${row.due_date}T00:00:00.000Z`)
            : undefined,
        completedAt: row.completed_at ?? undefined,
    });
}