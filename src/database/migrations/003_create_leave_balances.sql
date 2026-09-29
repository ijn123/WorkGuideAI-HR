BEGIN;

CREATE TABLE leave_balances (
                                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

                                employee_id UUID NOT NULL
                                    REFERENCES employees(id) ON DELETE RESTRICT,

                                year SMALLINT NOT NULL
                                    CHECK (year BETWEEN 2000 AND 2100),

    entitled_days NUMERIC(5, 1) NOT NULL
        CHECK (entitled_days >= 0),

    used_days NUMERIC(5, 1) NOT NULL DEFAULT 0
        CHECK (used_days >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT leave_balances_used_within_entitlement_check
    CHECK (used_days <= entitled_days),

    CONSTRAINT leave_balances_employee_year_unique
        UNIQUE (employee_id, year)
);

COMMIT;