import { Controller, Get } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import type {
    EmployeeResponseDto,
} from './dto/responses/employee-response.dto';

@Controller('employees')
export class EmployeesController {
    constructor(
        private readonly employeesService: EmployeesService,
    ) {}

    @Get()
    findAll(): Promise<EmployeeResponseDto[]> {
        return this.employeesService.findAll();
    }
}