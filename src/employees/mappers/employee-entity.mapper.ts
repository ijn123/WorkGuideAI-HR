import {
    Employee,
    EmployeeRole,
    EmploymentStatus,
} from '../employee.entity';

export interface EmployeeRow {
    id: string;
    first_name: string;
    last_name: string;
    work_email: string;
    department: string;
    role: EmployeeRole;
    employment_status: EmploymentStatus;
}

export function toEmployeeEntity(row: EmployeeRow): Employee {
    return new Employee({
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        workEmail: row.work_email,
        department: row.department,
        role: row.role,
        employmentStatus: row.employment_status,
    });
}