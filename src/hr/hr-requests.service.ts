import { Inject, Injectable } from '@nestjs/common';
import {
    HR_REQUESTS_REPOSITORY,
    type HrRequestsRepositoryInterface,
} from './interfaces/hr-requests-repository.interface';
import { toHrRequestResponse } from './mappers/hr-request-response.mapper';
import type {
    HrRequestResponseDto,
} from './dto/responses/hr-request-response.dto';

@Injectable()
export class HrRequestsService {
    constructor(
        @Inject(HR_REQUESTS_REPOSITORY)
        private readonly repository: HrRequestsRepositoryInterface,
    ) {}

    /**
     * Получает заявки сотрудника и формирует краткие ответы API.
     *
     * @param employeeId - Идентификатор сотрудника.
     * @returns Список заявок без подробного описания;
     * пустой массив, если заявок нет.
     *
     * @remarks
     * Метод не проверяет права доступа. Вызывающий код должен
     * обеспечить право пользователя читать заявки сотрудника.
     */
    async findRequestsByEmployeeId(
        employeeId: string,
    ): Promise<HrRequestResponseDto[]> {
        const requests =
            await this.repository.findRequestsByEmployeeId(employeeId);

        return requests.map((request) =>
            toHrRequestResponse({
                id: request.id,
                subject: request.subject,
                status: request.status,
            }),
        );
    }
}