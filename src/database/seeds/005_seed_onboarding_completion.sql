BEGIN;

UPDATE onboarding_tasks
SET completed_at = TIMESTAMPTZ '2026-09-16 12:00:00+00'
WHERE id = '40000000-0000-4000-8000-000000000001'
  AND status = 'completed'
  AND completed_at IS NULL;

COMMIT;