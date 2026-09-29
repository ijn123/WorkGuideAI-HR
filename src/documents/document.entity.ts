import { EmployeeRole } from '../employees/employee.entity';

/**
 * Publication state of an HR document.
 */
export enum DocumentStatus {
    DRAFT = 'draft',
    PUBLISHED = 'published',
    ARCHIVED = 'archived',
}

export interface DocumentProps {
    id: string;
    title: string;
    status: DocumentStatus;
    allowedRoles: readonly EmployeeRole[];
}

/**
 * Represents an HR document used as a source of company knowledge.
 *
 * The document defines its publication state and which employee
 * roles may read it. File storage and vector indexing are outside
 * this domain entity.
 */
export class Document {
    readonly id: string;
    readonly title: string;
    readonly status: DocumentStatus;
    readonly allowedRoles: readonly EmployeeRole[];

    constructor(props: DocumentProps) {
        const id = props.id.trim();
        const title = props.title.trim();

        if (!id) {
            throw new Error('Document id must not be empty');
        }

        if (!title) {
            throw new Error('Document title must not be empty');
        }

        if (!Object.values(DocumentStatus).includes(props.status)) {
            throw new Error('Invalid document status');
        }

        if (
            !Array.isArray(props.allowedRoles) ||
            props.allowedRoles.length === 0 ||
            props.allowedRoles.some(
                (role) => !Object.values(EmployeeRole).includes(role),
            )
        ) {
            throw new Error(
                'Document must have at least one valid allowed role',
            );
        }

        this.id = id;
        this.title = title;
        this.status = props.status;
        this.allowedRoles = Object.freeze([
            ...new Set(props.allowedRoles),
        ]);
    }

    /**
     * Checks publication state only; does not grant access.
     */
    isPublished(): boolean {
        return this.status === DocumentStatus.PUBLISHED;
    }

    /**
     * Checks whether a role may read the published document.
     */
    canBeReadBy(role: EmployeeRole): boolean {
        return this.isPublished() && this.allowedRoles.includes(role);
    }
}
