import {
    HrRequest,
    HrRequestStatus,
} from '../entities/hr-request.entity';

export interface HrRequestRow {
    id: string;
    employee_id: string;
    subject: string;
    description: string;
    status: HrRequestStatus;
}

export function toHrRequestEntity(row: HrRequestRow): HrRequest {
    return new HrRequest({
        id: row.id,
        employeeId: row.employee_id,
        subject: row.subject,
        description: row.description,
        status: row.status,
    });
}