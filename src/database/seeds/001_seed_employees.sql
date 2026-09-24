BEGIN;

INSERT INTO employees (
    id,
    first_name,
    last_name,
    work_email,
    department
)
VALUES
    (
        '10000000-0000-4000-8000-000000000001',
        'Anna',
        'Becker',
        'anna.becker@example.com',
        'HR'
    ),
    (
        '10000000-0000-4000-8000-000000000002',
        'Max',
        'Weber',
        'max.weber@example.com',
        'IT'
    ),
    (
        '10000000-0000-4000-8000-000000000003',
        'Lena',
        'Fischer',
        'lena.fischer@example.com',
        'Finance'
    )
    ON CONFLICT (id) DO NOTHING;

COMMIT;