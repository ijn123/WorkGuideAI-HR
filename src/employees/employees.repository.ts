import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { Employee } from './employee.entity';
import {
    toEmployeeEntity,
    type EmployeeRow,
} from './mappers/employee-entity.mapper';

@Injectable()
export class EmployeesRepository {
    constructor(private readonly database: DatabaseService) {}

    async findAll(): Promise<Employee[]> {
        const rows = await this.database.query<EmployeeRow>(
            `
        SELECT
          id,
          first_name,
          last_name,
          work_email,
          department,
          role,
          employment_status
        FROM employees
        ORDER BY last_name, first_name, id
        LIMIT 100
      `,
        );

        return rows.map(toEmployeeEntity);
    }
}