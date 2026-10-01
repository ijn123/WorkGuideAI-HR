import type { Employee } from '../employee.entity';

export const EMPLOYEES_REPOSITORY = Symbol(
    'EMPLOYEES_REPOSITORY',
);

export interface EmployeesRepositoryInterface {
    /**
     * Возвращает список сотрудников в пределах лимита реализации.
     */
    findAll(): Promise<Employee[]>;
}