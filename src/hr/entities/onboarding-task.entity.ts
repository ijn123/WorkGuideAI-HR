/**
 * Progress state of an employee onboarding task.
 */
export enum OnboardingTaskStatus {
    TODO = 'todo',
    IN_PROGRESS = 'in_progress',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
}

export interface OnboardingTaskProps {
    id: string;
    employeeId: string;
    title: string;
    status: OnboardingTaskStatus;
    dueAt?: Date;
    completedAt?: Date;
}

/**
 * Represents a step in an employee's onboarding process.
 *
 * The employeeId associates this task with the employee
 * being onboarded. Completion is recorded explicitly.
 */
export class OnboardingTask {
    readonly id: string;
    readonly employeeId: string;
    readonly title: string;
    readonly status: OnboardingTaskStatus;
    readonly dueAt?: Date;
    readonly completedAt?: Date;

    constructor(props: OnboardingTaskProps) {
        const id = props.id.trim();
        const employeeId = props.employeeId.trim();
        const title = props.title.trim();

        if (!id || !employeeId || !title) {
            throw new Error(
                'Onboarding task id, employeeId and title must not be empty',
            );
        }

        if (!Object.values(OnboardingTaskStatus).includes(props.status)) {
            throw new Error('Invalid onboarding task status');
        }

        if (props.dueAt && Number.isNaN(props.dueAt.getTime())) {
            throw new Error('dueAt must be a valid date');
        }

        if (props.completedAt && Number.isNaN(props.completedAt.getTime())) {
            throw new Error('completedAt must be a valid date');
        }

        if (
            props.status === OnboardingTaskStatus.COMPLETED &&
            !props.completedAt
        ) {
            throw new Error(
                'Completed onboarding task requires completedAt',
            );
        }

        if (
            props.status !== OnboardingTaskStatus.COMPLETED &&
            props.completedAt
        ) {
            throw new Error(
                'Only completed onboarding tasks may have completedAt',
            );
        }

        this.id = id;
        this.employeeId = employeeId;
        this.title = title;
        this.status = props.status;
        this.dueAt = props.dueAt
            ? new Date(props.dueAt.getTime())
            : undefined;
        this.completedAt = props.completedAt
            ? new Date(props.completedAt.getTime())
            : undefined;
    }
}
