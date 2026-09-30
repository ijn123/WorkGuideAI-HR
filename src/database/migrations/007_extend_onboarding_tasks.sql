BEGIN;

ALTER TABLE onboarding_tasks
    ADD COLUMN completed_at TIMESTAMPTZ;

ALTER TABLE onboarding_tasks
DROP CONSTRAINT onboarding_tasks_status_check;

ALTER TABLE onboarding_tasks
    ADD CONSTRAINT onboarding_tasks_status_check
        CHECK (
            status IN (
                       'pending',
                       'in_progress',
                       'completed',
                       'cancelled'
                )
            );

COMMIT;