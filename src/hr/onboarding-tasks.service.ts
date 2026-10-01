import { Inject, Injectable } from '@nestjs/common';
import {
    ONBOARDING_TASKS_REPOSITORY,
    type OnboardingTasksRepositoryInterface,
} from './interfaces/onboarding-tasks-repository.interface';
import { OnboardingTaskStatus } from './entities/onboarding-task.entity';
import {
    onboardingTaskResponseSchema,
    type OnboardingTaskResponseDto,
} from './dto/responses/onboarding-task-response.dto';

@Injectable()
export class OnboardingTasksService {
    constructor(
        @Inject(ONBOARDING_TASKS_REPOSITORY)
        private readonly repository: OnboardingTasksRepositoryInterface,
    ) {}

    /**
     * Получает задачи адаптации сотрудника и формирует ответы API.
     *
     * @param employeeId - Идентификатор сотрудника.
     * @returns Список задач или пустой массив, если задач нет.
     *
     * @remarks
     * Доменный статус todo преобразуется в статус API pending.
     * Срок возвращается как YYYY-MM-DD в UTC либо null.
     * Вызывающий код должен обеспечить право пользователя
     * читать задачи указанного сотрудника.
     */
    async findOnboardingTasksByEmployeeId(
        employeeId: string,
    ): Promise<OnboardingTaskResponseDto[]> {
        const tasks =
            await this.repository.findOnboardingTasksByEmployeeId(
                employeeId,
            );

        return tasks.map((task) =>
            onboardingTaskResponseSchema.parse({
                id: task.id,
                employeeId: task.employeeId,
                title: task.title,
                status:
                    task.status === OnboardingTaskStatus.TODO
                        ? 'pending'
                        : task.status,
                dueDate: task.dueAt
                    ? task.dueAt.toISOString().slice(0, 10)
                    : null,
            }),
        );
    }
}