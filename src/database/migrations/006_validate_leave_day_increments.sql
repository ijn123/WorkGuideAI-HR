BEGIN;

ALTER TABLE leave_balances
    ADD CONSTRAINT leave_balances_entitled_half_day_check
        CHECK (mod(entitled_days, 0.5) = 0),
    ADD CONSTRAINT leave_balances_used_half_day_check
        CHECK (mod(used_days, 0.5) = 0);

COMMIT;