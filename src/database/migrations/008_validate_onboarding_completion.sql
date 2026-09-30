BEGIN;

ALTER TABLE onboarding_tasks
    ADD CONSTRAINT onboarding_tasks_completion_check
        CHECK (
            (status = 'completed' AND completed_at IS NOT NULL)
                OR
            (status <> 'completed' AND completed_at IS NULL)
            );

COMMIT;