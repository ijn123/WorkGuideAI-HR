import { Inject, Injectable } from '@nestjs/common';
import {
    EMPLOYEES_REPOSITORY,
    type EmployeesRepositoryInterface,
} from './interfaces/employees-repository.interface';
import { toEmployeeResponse } from './mappers/employee-response.mapper';
import type {
    EmployeeResponseDto,
} from './dto/responses/employee-response.dto';

@Injectable()
export class EmployeesService {
    constructor(
        @Inject(EMPLOYEES_REPOSITORY)
        private readonly employeesRepository: EmployeesRepositoryInterface,
    ) {}

    async findAll(): Promise<EmployeeResponseDto[]> {
        const employees = await this.employeesRepository.findAll();

        return employees.map((employee) =>
            toEmployeeResponse({
                id: employee.id,
                firstName: employee.firstName,
                lastName: employee.lastName,
                workEmail: employee.workEmail,
                department: employee.department,
            }),
        );
    }
}