const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
require('reflect-metadata');
const { ValidationPipe } = require('@nestjs/common');
const { CreateEmployeeDto } = require('../../dist/employees/dto/request/create-employee.dto');
const { UpdateEmployeeDto } = require('../../dist/employees/dto/request/update-employee.dto');
const { CreateHrRequestDto } = require('../../dist/hr/dto/requests/create-hr-request.dto');
const { UpdateHrRequestDto } = require('../../dist/hr/dto/requests/update-hr-request.dto');

const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
});

function validateBody(metatype, body) {
    return pipe.transform(body, { type: 'body', metatype });
}

async function expect400(metatype, body) {
    await assert.rejects(() => validateBody(metatype, body), error => {
        assert.equal(error.getStatus(), 400);
        return true;
    });
}

const employee = {
    firstName: 'Ada',
    lastName: 'Lovelace',
    workEmail: 'ada@example.com',
    department: 'Engineering',
};
const hrRequest = { subject: 'Leave request', description: 'Please review my leave request.' };
const contracts = [
    {
        create: CreateEmployeeDto,
        update: UpdateEmployeeDto,
        valid: employee,
        limits: { firstName: 100, lastName: 100, workEmail: 254, department: 100 },
    },
    {
        create: CreateHrRequestDto,
        update: UpdateHrRequestDto,
        valid: hrRequest,
        limits: { subject: 200, description: 5000 },
    },
];
const invalidValues = [
    ['null', null],
    ['empty string', ''],
    ['whitespace-only string', ' \t\n '],
    ['number', 42],
    ['boolean', true],
    ['array', ['valid-looking text']],
    ['object', { value: 'valid-looking text' }],
];

function boundaryValue(field, maximum) {
    if (field === 'workEmail') {
        return 'a'.repeat(64) + '@' + 'b'.repeat(63) + '.' + 'c'.repeat(63) + '.' + 'd'.repeat(57) + '.com';
    }
    return 'a'.repeat(maximum);
}

function paddedValue(field, value) {
    return ` \t${field === 'workEmail' ? value.toUpperCase() : value}\n `;
}

for (const { create, update, valid, limits } of contracts) {
    describe(create.name, () => {
        it('accepts valid input and returns a DTO instance', async () => {
            const result = await validateBody(create, valid);
            assert.ok(result instanceof create);
            for (const [field, value] of Object.entries(valid)) assert.equal(result[field], value);
        });

        it('normalizes all strings without changing their content', async () => {
            const body = Object.fromEntries(Object.entries(valid).map(([field, value]) => [field, paddedValue(field, value)]));
            const result = await validateBody(create, body);
            for (const [field, value] of Object.entries(valid)) assert.equal(result[field], value);
        });

        it('rejects unknown properties', async () => {
            await expect400(create, { ...valid, unexpected: 'value' });
        });

        for (const [field, maximum] of Object.entries(limits)) {
            it(`rejects missing required ${field}`, async () => {
                const body = { ...valid };
                delete body[field];
                await expect400(create, body);
                await expect400(create, { ...valid, [field]: undefined });
            });

            for (const [name, value] of invalidValues) {
                it(`rejects ${name} for ${field}`, async () => {
                    await expect400(create, { ...valid, [field]: value });
                });
            }

            it(`preserves the normalized ${maximum} length boundary for ${field}`, async () => {
                const value = boundaryValue(field, maximum);
                assert.equal(value.length, maximum);
                assert.equal((await validateBody(create, { ...valid, [field]: paddedValue(field, value) }))[field], value);
                await expect400(create, { ...valid, [field]: 'a' + value });
            });

            if (field !== 'workEmail') {
                it(`preserves the UTF-16 length boundary for ${field}`, async () => {
                    const value = '😀'.repeat(maximum / 2);
                    assert.equal(value.length, maximum);
                    assert.equal((await validateBody(create, { ...valid, [field]: value }))[field], value);
                    await expect400(create, { ...valid, [field]: value + 'a' });
                });
            }
        }
    });

    describe(update.name, () => {
        it('rejects an empty update and an update with only undefined fields', async () => {
            await expect400(update, {});
            await expect400(update, Object.fromEntries(Object.keys(valid).map(field => [field, undefined])));
        });

        it('accepts and normalizes combinations of supplied fields', async () => {
            const entries = Object.entries(valid);
            for (const selected of [entries.slice(0, 2), entries]) {
                const body = Object.fromEntries(selected.map(([field, value]) => [field, paddedValue(field, value)]));
                const result = await validateBody(update, body);
                assert.ok(result instanceof update);
                for (const [field, value] of selected) assert.equal(result[field], value);
            }
        });

        it('rejects unknown properties alone and alongside valid fields', async () => {
            await expect400(update, { unexpected: 'value' });
            await expect400(update, { ...valid, unexpected: 'value' });
            await expect400(update, { ...valid, unexpected: undefined });
        });

        for (const [field, maximum] of Object.entries(limits)) {
            it(`accepts individual ${field}, normalizes it and allows absent or undefined peers`, async () => {
                const result = await validateBody(update, { [field]: paddedValue(field, valid[field]) });
                assert.equal(result[field], valid[field]);
                for (const other of Object.keys(valid).filter(name => name !== field)) assert.equal(result[other], undefined);
                const withUndefinedPeers = Object.fromEntries(Object.keys(valid).map(name => [name, name === field ? valid[field] : undefined]));
                assert.equal((await validateBody(update, withUndefinedPeers))[field], valid[field]);
            });

            for (const [name, value] of invalidValues) {
                it(`rejects supplied ${name} for ${field} even with valid peers`, async () => {
                    await expect400(update, { [field]: value });
                    await expect400(update, { ...valid, [field]: value });
                });
            }

            it(`preserves the normalized ${maximum} length boundary for supplied ${field}`, async () => {
                const value = boundaryValue(field, maximum);
                assert.equal((await validateBody(update, { [field]: paddedValue(field, value) }))[field], value);
                await expect400(update, { [field]: 'a' + value });
                if (field !== 'workEmail') {
                    const unicode = '😀'.repeat(maximum / 2);
                    assert.equal((await validateBody(update, { [field]: unicode }))[field], unicode);
                    await expect400(update, { [field]: unicode + 'a' });
                }
            });
        }
    });
}

for (const metatype of [CreateEmployeeDto, UpdateEmployeeDto]) {
    describe(`${metatype.name} email format`, () => {
        for (const workEmail of ['invalid', 'a..b@example.com', 'a@example', 'é@example.com']) {
            it(`rejects invalid email ${JSON.stringify(workEmail)}`, async () => {
                await expect400(metatype, { ...employee, workEmail });
            });
        }
    });
}
