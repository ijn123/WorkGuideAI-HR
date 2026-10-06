import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { EmployeesRepository } from './employees.repository';

@Module({
    imports: [DatabaseModule, AuthModule],
    controllers: [EmployeesController],
    providers: [EmployeesService, EmployeesRepository],
    exports: [EmployeesService],
})
export class EmployeesModule {}
