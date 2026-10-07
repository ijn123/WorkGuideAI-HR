BEGIN;

ALTER TABLE employees
    ADD COLUMN password_hash TEXT;

COMMIT;
