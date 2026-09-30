BEGIN;

ALTER TABLE employees
    ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'employee',
    ADD COLUMN employment_status VARCHAR(20) NOT NULL DEFAULT 'active';

ALTER TABLE employees
    ADD CONSTRAINT employees_role_check
        CHECK (role IN ('employee', 'hr', 'admin')),
    ADD CONSTRAINT employees_employment_status_check
        CHECK (employment_status IN ('active', 'inactive'));

COMMIT;