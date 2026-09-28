/**
 * Current business state of an HR request.
 *
 * Values match the existing HR request response contract.
 */
export enum HrRequestStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    REJECTED = 'rejected',
}

export interface HrRequestProps {
    id: string;
    employeeId: string;
    subject: string;
    description: string;
    status: HrRequestStatus;
}

/**
 * Represents a request submitted by an employee to HR.
 *
 * The employeeId links the request to its author.
 * Approval and rejection describe HR decisions, not database states.
 */
export class HrRequest {
    readonly id: string;
    readonly employeeId: string;
    readonly subject: string;
    readonly description: string;
    readonly status: HrRequestStatus;

    constructor(props: HrRequestProps) {
        this.id = HrRequest.requireText(props.id, 'id');
        this.employeeId = HrRequest.requireText(
            props.employeeId,
            'employeeId',
        );
        this.subject = HrRequest.requireText(
            props.subject,
            'subject',
            200,
        );
        this.description = HrRequest.requireText(
            props.description,
            'description',
            5000,
        );

        if (!Object.values(HrRequestStatus).includes(props.status)) {
            throw new Error('Invalid HR request status');
        }

        this.status = props.status;
    }

    /**
     * A completed decision cannot be changed within this workflow.
     */
    canBeDecided(): boolean {
        return this.status === HrRequestStatus.PENDING;
    }

    private static requireText(
        value: string,
        field: string,
        maxLength?: number,
    ): string {
        const trimmed = value.trim();

        if (!trimmed) {
            throw new Error(`HR request ${field} must not be empty`);
        }

        if (maxLength !== undefined && trimmed.length > maxLength) {
            throw new Error(
                `HR request ${field} must not exceed ${maxLength} characters`,
            );
        }

        return trimmed;
    }
}
