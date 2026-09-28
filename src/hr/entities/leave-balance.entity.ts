export interface LeaveBalanceProps {
    id: string;
    employeeId: string;
    year: number;
    entitledDays: number;
    usedDays: number;
}

/**
 * Represents an employee's annual leave entitlement.
 *
 * A balance belongs to one employee for one calendar year.
 * Entitled and used days are measured in increments of 0.5 day.
 * Remaining days are derived from entitlement and usage,
 * rather than stored as a separate value.
 *
 * Uniqueness of the employee and year pair must be enforced
 * when balances are persisted; one entity cannot check other balances.
 */
export class LeaveBalance {
    readonly id: string;
    readonly employeeId: string;
    readonly year: number;
    readonly entitledDays: number;
    readonly usedDays: number;

    constructor(props: LeaveBalanceProps) {
        const id = props.id.trim();
        const employeeId = props.employeeId.trim();

        if (!id) {
            throw new Error('Leave balance id must not be empty');
        }

        if (!employeeId) {
            throw new Error('Leave balance employeeId must not be empty');
        }

        if (!Number.isInteger(props.year) || props.year < 1) {
            throw new Error('Leave balance year must be a valid calendar year');
        }

        if (!LeaveBalance.isValidDays(props.entitledDays)) {
            throw new Error(
                'entitledDays must be a non-negative number of whole or half days',
            );
        }

        if (!LeaveBalance.isValidDays(props.usedDays)) {
            throw new Error(
                'usedDays must be a non-negative number of whole or half days',
            );
        }

        if (props.usedDays > props.entitledDays) {
            throw new Error(
                'usedDays cannot exceed entitledDays',
            );
        }

        this.id = id;
        this.employeeId = employeeId;
        this.year = props.year;
        this.entitledDays = props.entitledDays;
        this.usedDays = props.usedDays;
    }

    get remainingDays(): number {
        return this.entitledDays - this.usedDays;
    }

    private static isValidDays(value: number): boolean {
        return Number.isFinite(value) &&
            value >= 0 &&
            Number.isInteger(value * 2);
    }
}
