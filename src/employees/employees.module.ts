import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { EmployeesRepository } from './employees.repository';

@Module({
    imports: [DatabaseModule],
    controllers: [EmployeesController],
    providers: [EmployeesService, EmployeesRepository],
    exports: [EmployeesService],
})
export class EmployeesModule {}
