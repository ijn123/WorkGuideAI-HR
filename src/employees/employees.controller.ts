import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { EmployeesService } from './employees.service';
import type {
    EmployeeResponseDto,
} from './dto/responses/employee-response.dto';

@Controller('employees')
@UseGuards(AuthGuard)
export class EmployeesController {
    constructor(
        private readonly employeesService: EmployeesService,
    ) {}

    @Get()
    findAll(): Promise<EmployeeResponseDto[]> {
        return this.employeesService.findAll();
    }
}
