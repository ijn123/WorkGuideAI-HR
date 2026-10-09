const { randomBytes } = require('node:crypto');
const { assertDatabaseIdentity } = require('./database.cjs');

const EMPLOYEES = Object.freeze({
    active: Object.freeze({ id: 'a0000000-0000-4000-8000-000000000001', email: 'active.employee@example.invalid', status: 'active' }),
    inactive: Object.freeze({ id: 'a0000000-0000-4000-8000-000000000002', email: 'inactive.employee@example.invalid', status: 'inactive' }),
    unprovisioned: Object.freeze({ id: 'a0000000-0000-4000-8000-000000000003', email: 'unprovisioned.employee@example.invalid', status: 'active', passwordEnabled: false }),
});

async function createEmployeeFixtures(passwordService, additionalEmployees = {}) {
    // Employee identities are deterministic; credentials are generated privately per suite.
    const password = `  ${randomBytes(32).toString('hex')}  `;
    const passwordHash = await passwordService.hash(password);
    const employees = Object.fromEntries(Object.entries({ ...EMPLOYEES, ...additionalEmployees })
        .map(([kind, employee]) => [kind, Object.freeze({
            firstName: 'Integration', lastName: kind, department: 'Testing', role: 'employee', ...employee,
        })]));
    return {
        employees: Object.freeze(employees),
        password,
        sensitiveValues: [password, passwordHash],
        async insert(client, context, records = Object.values(employees)) {
            await assertDatabaseIdentity(client, context, 'migration');
            try {
                await client.query('BEGIN');
                for (const employee of records) {
                    await client.query(`
                        INSERT INTO public.employees
                            (id, first_name, last_name, work_email, department, role,
                             employment_status, password_hash, created_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    `, [employee.id, employee.firstName, employee.lastName, employee.email, employee.department, employee.role,
                        employee.status, employee.passwordEnabled === false ? null : passwordHash, '2026-01-01T00:00:00Z']);
                }
                await client.query('COMMIT');
            } catch {
                await client.query('ROLLBACK').catch(() => {});
                throw new Error('Could not insert isolated employee fixtures.');
            }
        },
    };
}

function createHrFixtures(employees) {
    const owner = employees.active.id;
    const other = employees.other.id;
    const id = (prefix, index) => `${prefix}0000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
    const requests = ['pending', 'approved', 'rejected'].map((status, index) => ({
        id: id('d', [1, 3, 2][index]), employeeId: owner, subject: `Request ${index + 1}`,
        description: `Private request details ${index + 1}`, status,
        createdAt: index < 2 ? '2026-01-03T12:00:00Z' : '2026-01-01T12:00:00Z',
    }));
    requests.push({ ...requests[0], id: id('d', 4), employeeId: other,
        subject: 'Other employee request', createdAt: '2026-12-01T00:00:00Z' });
    const balances = [
        [2026, 30, 8], [2027, 28.5, 12.5], [2028, 28, 12.5], [2000, 0, 0], [2100, 0, 0],
    ].map(([year, entitledDays, usedDays], index) => ({
        id: id('e', index + 1), employeeId: owner, year, entitledDays, usedDays,
    }));
    balances.push({ id: id('e', 6), employeeId: other, year: 2026, entitledDays: 40, usedDays: 1 });
    const tasks = ['pending', 'in_progress', 'completed', 'cancelled', 'pending'].map((status, index) => ({
        id: id('f', [1, 3, 2, 4, 5][index]), employeeId: owner, title: `Task ${index + 1}`,
        description: `Private onboarding details ${index + 1}`, status,
        dueDate: index < 2 ? '2026-01-02' : index === 2 ? '2026-02-01' : null,
        completedAt: status === 'completed' ? '2026-02-01T23:00:00Z' : null,
    }));
    tasks.push({ ...tasks[0], id: id('f', 6), employeeId: other, title: 'Other employee task', dueDate: '2025-01-01' });
    const data = { requests, balances, tasks };
    return {
        ...data,
        internalValues: [...requests, ...tasks].map(row => row.description),
        async insert(client, context, records = { requests: requests.toReversed(), balances, tasks: tasks.toReversed() }) {
            await assertDatabaseIdentity(client, context, 'migration');
            try {
                await client.query('BEGIN');
                for (const row of records.requests ?? []) {
                    await client.query(`
                        INSERT INTO public.hr_requests (id, employee_id, subject, description, status, created_at)
                        VALUES ($1, $2, $3, $4, $5, $6)
                    `, [row.id, row.employeeId, row.subject, row.description, row.status, row.createdAt]);
                }
                for (const row of records.balances ?? []) {
                    await client.query(`
                        INSERT INTO public.leave_balances (id, employee_id, year, entitled_days, used_days, created_at)
                        VALUES ($1, $2, $3, $4, $5, $6)
                    `, [row.id, row.employeeId, row.year, row.entitledDays, row.usedDays, '2026-01-01T00:00:00Z']);
                }
                for (const row of records.tasks ?? []) {
                    await client.query(`
                        INSERT INTO public.onboarding_tasks
                            (id, employee_id, title, description, status, due_date, completed_at, created_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    `, [row.id, row.employeeId, row.title, row.description, row.status, row.dueDate, row.completedAt,
                        '2026-01-01T00:00:00Z']);
                }
                await client.query('COMMIT');
            } catch {
                await client.query('ROLLBACK').catch(() => {});
                throw new Error('Could not insert isolated HR fixtures.');
            }
        },
    };
}

function createDocumentFixture() {
    const document = {
        id: 'b0000000-0000-4000-8000-000000000001', title: 'Integration policy',
        generationId: 'b0000000-0000-4000-8000-000000000002',
        chunkId: 'b0000000-0000-4000-8000-000000000003',
    };
    return {
        ...document,
        async insert(client, context, allowedRoles = ['employee']) {
            await assertDatabaseIdentity(client, context, 'migration');
            try {
                await client.query(`
                    INSERT INTO public.documents
                        (id, title, status, allowed_roles, indexing_status, indexing_generation, indexed_at, created_at)
                    VALUES ($1, $2, 'published', $3, 'ready', $4, $5, $5)
                `, [document.id, document.title, allowedRoles, document.generationId, '2026-01-01T00:00:00Z']);
            } catch {
                throw new Error('Could not insert isolated document fixture.');
            }
        },
    };
}

module.exports = { createEmployeeFixtures, createHrFixtures, createDocumentFixture };
