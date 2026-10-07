import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { EmployeesRepository } from './employees.repository';
import {
    EMPLOYEES_REPOSITORY,
} from './interfaces/employees-repository.interface';

@Module({
    imports: [DatabaseModule, AuthModule],
    controllers: [EmployeesController],
    providers: [
        EmployeesService,
        {
            provide: EMPLOYEES_REPOSITORY,
            useClass: EmployeesRepository,
        },
    ],
    exports: [EmployeesService],
})
export class EmployeesModule {}
