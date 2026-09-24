BEGIN;

CREATE TABLE hr_requests (
                             id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

                             employee_id UUID NOT NULL
                                 REFERENCES employees(id) ON DELETE RESTRICT,

                             subject VARCHAR(200) NOT NULL
                                 CHECK (length(trim(subject)) > 0),

                             description VARCHAR(5000) NOT NULL
                                 CHECK (length(trim(description)) > 0),

                             status VARCHAR(20) NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending', 'approved', 'rejected')),

                             created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX hr_requests_employee_id_idx
    ON hr_requests (employee_id);

COMMIT;