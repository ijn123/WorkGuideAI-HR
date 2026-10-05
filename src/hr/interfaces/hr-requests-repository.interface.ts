import type { HrRequest } from '../entities/hr-request.entity';

export const HR_REQUESTS_REPOSITORY = Symbol(
    'HR_REQUESTS_REPOSITORY',
);

export interface HrRequestsRepositoryInterface {
    /**
     * Возвращает заявки указанного сотрудника:
     * сначала новые, в пределах лимита реализации.
     */
    findRequestsByEmployeeId(
        employeeId: string,
    ): Promise<HrRequest[]>;
}