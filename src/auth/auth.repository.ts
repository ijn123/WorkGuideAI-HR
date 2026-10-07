import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type {
    EmployeeRole,
    EmploymentStatus,
} from '../employees/employee.entity';

export interface AuthenticatedEmployee {
    id: string;
    role: EmployeeRole;
    employmentStatus: EmploymentStatus;
}

export interface EmployeeCredentials extends AuthenticatedEmployee {
    passwordHash: string | null;
}

interface AuthenticatedEmployeeRow {
    id: string;
    role: EmployeeRole;
    employment_status: EmploymentStatus;
}

interface EmployeeCredentialsRow extends AuthenticatedEmployeeRow {
    password_hash: string | null;
}

@Injectable()
export class AuthRepository {
    constructor(private readonly database: DatabaseService) {}

    async findCredentialsByWorkEmail(
        workEmail: string,
    ): Promise<EmployeeCredentials | null> {
        const rows = await this.database.query<EmployeeCredentialsRow>(
            `
                SELECT id, role, password_hash, employment_status
                FROM employees
                WHERE lower(work_email) = $1
            `,
            [workEmail.trim().toLowerCase()],
        );

        const row = rows[0];

        return row
            ? {
                id: row.id,
                role: row.role,
                passwordHash: row.password_hash,
                employmentStatus: row.employment_status,
            }
            : null;
    }

    async findAuthenticatedEmployeeById(
        employeeId: string,
    ): Promise<AuthenticatedEmployee | null> {
        const rows = await this.database.query<AuthenticatedEmployeeRow>(
            `
                SELECT id, role, employment_status
                FROM employees
                WHERE id = $1
            `,
            [employeeId],
        );

        const row = rows[0];

        return row
            ? {
                id: row.id,
                role: row.role,
                employmentStatus: row.employment_status,
            }
            : null;
    }
}
