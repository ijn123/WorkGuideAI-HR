import { Controller, Get, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EmployeesService } from './employees.service';
import { EmployeeRole } from './employee.entity';
import type {
    EmployeeResponseDto,
} from './dto/responses/employee-response.dto';

@Controller('employees')
export class EmployeesController {
    constructor(
        private readonly employeesService: EmployeesService,
    ) {}

    @Get()
    @UseGuards(RolesGuard)
    @Roles(EmployeeRole.HR, EmployeeRole.ADMIN)
    findAll(): Promise<EmployeeResponseDto[]> {
        return this.employeesService.findAll();
    }
}