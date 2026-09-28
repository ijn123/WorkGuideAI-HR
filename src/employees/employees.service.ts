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
                firstName: employee.first_name,
                lastName: employee.last_name,
                workEmail: employee.work_email,
                department: employee.department,
            }),
        );
    }
}
