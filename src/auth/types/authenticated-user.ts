import type { EmployeeRole } from '../../employees/employee.entity';

export interface AuthenticatedUser {
    employeeId: string;
    role: EmployeeRole;
}