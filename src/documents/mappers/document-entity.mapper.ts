import {
    Document,
    DocumentStatus,
} from '../document.entity';
import type { EmployeeRole } from '../../employees/employee.entity';

export interface DocumentRow {
    id: string;
    title: string;
    status: DocumentStatus;
    allowed_roles: EmployeeRole[];
}

export function toDocumentEntity(row: DocumentRow): Document {
    return new Document({
        id: row.id,
        title: row.title,
        status: row.status,
        allowedRoles: row.allowed_roles,
    });
}