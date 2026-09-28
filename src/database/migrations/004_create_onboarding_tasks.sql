BEGIN;

CREATE TABLE onboarding_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    employee_id UUID NOT NULL
        REFERENCES employees(id) ON DELETE RESTRICT,

    title VARCHAR(200) NOT NULL
        CHECK (length(trim(title)) > 0),

    description VARCHAR(2000),

    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'completed')),

    due_date DATE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX onboarding_tasks_employee_id_idx
    ON onboarding_tasks (employee_id);

COMMIT;