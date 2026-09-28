import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface EmployeeRow {
    id: string;
    first_name: string;
    last_name: string;
    work_email: string;
    department: string;
}

@Injectable()
export class EmployeesRepository {
    constructor(private readonly database: DatabaseService) {}

    async findAll(): Promise<EmployeeRow[]> {
        return this.database.query<EmployeeRow>(
            `
        SELECT
          id,
          first_name,
          last_name,
          work_email,
          department
        FROM employees
        ORDER BY last_name, first_name, id
        LIMIT 100
      `,
        );
    }
}
