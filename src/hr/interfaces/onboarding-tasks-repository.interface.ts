import type {
    OnboardingTask,
} from '../entities/onboarding-task.entity';

export const ONBOARDING_TASKS_REPOSITORY = Symbol(
    'ONBOARDING_TASKS_REPOSITORY',
);

export interface OnboardingTasksRepositoryInterface {
    /**
     * Возвращает задачи адаптации указанного сотрудника.
     *
     * @returns Задачи в порядке ближайшего срока,
     * задачи без срока — в конце. При отсутствии задач — пустой массив.
     *
     * @remarks
     * Количество записей ограничено реализацией репозитория.
     */
    findOnboardingTasksByEmployeeId(
        employeeId: string,
    ): Promise<OnboardingTask[]>;
}