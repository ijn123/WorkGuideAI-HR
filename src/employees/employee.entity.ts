/**
 * Access role assigned to an employee in WorkGuide AI.
 */
export enum EmployeeRole {
    EMPLOYEE = 'employee',
    HR = 'hr',
    ADMIN = 'admin',
}

/**
 * Employment state of a person registered in the company.
 * This is separate from the employee's access role.
 */
export enum EmploymentStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
}

/**
 * Represents an employee registered in the company.
 *
 * An employee belongs to a department and can be associated
 * with HR requests, leave balances and onboarding tasks.
 * Access role and employment status describe different business concepts.
 */
export class Employee {
    readonly id: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly workEmail: string;
    readonly department: string;
    readonly role: EmployeeRole;
    readonly employmentStatus: EmploymentStatus;

    constructor(props: {
        id: string;
        firstName: string;
        lastName: string;
        workEmail: string;
        department: string;
        role: EmployeeRole;
        employmentStatus: EmploymentStatus;
    }) {
        this.id = Employee.requireNonEmpty(props.id, 'id');
        this.firstName = Employee.requireNonEmpty(
            props.firstName,
            'firstName',
            100,
        );
        this.lastName = Employee.requireNonEmpty(
            props.lastName,
            'lastName',
            100,
        );
        this.department = Employee.requireNonEmpty(
            props.department,
            'department',
            100,
        );

        const workEmail = Employee.requireNonEmpty(
            props.workEmail,
            'workEmail',
            254,
        ).toLowerCase();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workEmail)) {
            throw new Error('workEmail must be a valid email address');
        }

        this.workEmail = workEmail;

        if (!Object.values(EmployeeRole).includes(props.role)) {
            throw new Error('Invalid employee role');
        }

        this.role = props.role;

        if (
            !Object.values(EmploymentStatus).includes(
                props.employmentStatus,
            )
        ) {
            throw new Error('Invalid employment status');
        }

        this.employmentStatus = props.employmentStatus;
    }

    private static requireNonEmpty(
        value: string,
        field: string,
        maxLength?: number,
    ): string {
        const trimmed = value.trim();

        if (!trimmed) {
            throw new Error(`${field} must not be empty`);
        }

        if (maxLength !== undefined && trimmed.length > maxLength) {
            throw new Error(
                `${field} must not exceed ${maxLength} characters`,
            );
        }

        return trimmed;
    }
}
