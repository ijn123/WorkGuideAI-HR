import { Controller, Get, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EmployeeRole } from './employee.entity';
import { EmployeesService } from './employees.service';
import type {
    EmployeeResponseDto,
} from './dto/responses/employee-response.dto';

@Controller('employees')
@UseGuards(AuthGuard, RolesGuard)
export class EmployeesController {
    constructor(
        private readonly employeesService: EmployeesService,
    ) {}

    @Get()
    @Roles(EmployeeRole.HR, EmployeeRole.ADMIN)
    findAll(): Promise<EmployeeResponseDto[]> {
        return this.employeesService.findAll();
    }
}