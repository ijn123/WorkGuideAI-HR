BEGIN;

INSERT INTO onboarding_tasks (
    id,
    employee_id,
    title,
    description,
    status,
    due_date,
    completed_at
)
VALUES
    (
        '40000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000001',
        'Read HR policies',
        'Review the internal employee handbook.',
        'completed',
        '2026-09-15',
        TIMESTAMPTZ '2026-09-16 12:00:00+00'
    ),
    (
        '40000000-0000-4000-8000-000000000002',
        '10000000-0000-4000-8000-000000000002',
        'Complete security training',
        'Complete the introductory information security course.',
        'in_progress',
        '2026-09-30',
        NULL
    ),
    (
        '40000000-0000-4000-8000-000000000003',
        '10000000-0000-4000-8000-000000000003',
        'Meet the team',
        'Attend an introductory meeting with the Finance team.',
        'pending',
        NULL,
        NULL
    )
    ON CONFLICT (id) DO NOTHING;

COMMIT;