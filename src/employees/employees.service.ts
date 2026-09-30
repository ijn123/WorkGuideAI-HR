import { Injectable } from '@nestjs/common';
import { EmployeesRepository } from './employees.repository';
import { toEmployeeResponse } from './mappers/employee-response.mapper';
import type {
    EmployeeResponseDto,
} from './dto/responses/employee-response.dto';

@Injectable()
export class EmployeesService {
    constructor(
        private readonly employeesRepository: EmployeesRepository,
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