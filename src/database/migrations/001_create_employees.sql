BEGIN;

CREATE TABLE employees (
                           id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

                           first_name VARCHAR(100) NOT NULL
                               CHECK (length(trim(first_name)) > 0),

                           last_name VARCHAR(100) NOT NULL
                               CHECK (length(trim(last_name)) > 0),

                           work_email VARCHAR(254) NOT NULL
                               CHECK (length(trim(work_email)) > 0),

                           department VARCHAR(100) NOT NULL
                               CHECK (length(trim(department)) > 0),

                           created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX employees_work_email_unique
    ON employees (lower(work_email));

COMMIT;