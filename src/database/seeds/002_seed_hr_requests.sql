BEGIN;

INSERT INTO hr_requests (
    id,
    employee_id,
    subject,
    description,
    status
)
VALUES
    (
        '20000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000001',
        'Employment certificate',
        'Please prepare an employment certificate in English.',
        'pending'
    ),
    (
        '20000000-0000-4000-8000-000000000002',
        '10000000-0000-4000-8000-000000000002',
        'Training request',
        'I would like to attend a PostgreSQL training course.',
        'approved'
    ),
    (
        '20000000-0000-4000-8000-000000000003',
        '10000000-0000-4000-8000-000000000003',
        'Remote work request',
        'I would like to work remotely for one additional day per week.',
        'rejected'
    )
    ON CONFLICT (id) DO NOTHING;

COMMIT;