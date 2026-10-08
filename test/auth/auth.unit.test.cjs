const assert = require('node:assert/strict');
const { before, describe, it } = require('node:test');
const fixtures = require('./fixtures.cjs');
const { UnauthorizedException, InternalServerErrorException, Logger, ValidationPipe } = require('@nestjs/common');
const { ROUTE_ARGS_METADATA } = require('@nestjs/common/constants');
const { LoginDto } = require('../../dist/auth/dto/login.dto');
const { AskQuestionDto } = require('../../dist/chat/dto/requests/ask-question.dto');
const { PasswordService } = require('../../dist/auth/password.service');
const { AuthService } = require('../../dist/auth/auth.service');
const { AuthGuard } = require('../../dist/auth/guards/auth.guard');
const { CurrentUser } = require('../../dist/auth/decorators/current-user.decorator');
const { validateEnvironment } = require('../../dist/config/env.schema');
const { jwtPayloadSchema } = require('../../dist/auth/schemas/jwt-payload.schema');

async function expect401(operation, response = new UnauthorizedException().getResponse()) {
    await assert.rejects(operation, error => {
        assert.ok(error instanceof UnauthorizedException);
        assert.equal(error.getStatus(), 401);
        assert.deepEqual(error.getResponse(), response);
        return true;
    });
}

const validationPipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
});

function validateBody(metatype, value) {
    return validationPipe.transform(value, { type: 'body', metatype });
}

async function expect400(operation) {
    await assert.rejects(operation, error => {
        assert.equal(error.getStatus(), 400);
        return true;
    });
}

describe('Login DTO', () => {
    const valid = { workEmail: fixtures.EMAIL, password: fixtures.PASSWORD };

    it('normalizes email, preserves exact password and returns a DTO instance', async () => {
        const result = await validateBody(LoginDto, { ...valid, workEmail: ` ${fixtures.EMAIL.toUpperCase()} ` });
        assert.ok(result instanceof LoginDto);
        assert.equal(result.workEmail, fixtures.EMAIL);
        assert.equal(result.password, fixtures.PASSWORD);
    });

    for (const field of ['workEmail', 'password']) {
        it(`rejects missing ${field}`, async () => {
            const body = { ...valid };
            delete body[field];
            await expect400(() => validateBody(LoginDto, body));
        });
        for (const [name, value] of [
            ['null', null], ['empty string', ''], ['number', 42],
            ['boolean', true], ['array', ['test']], ['object', { value: 'test' }],
        ]) {
            it(`rejects ${name} for ${field}`, async () => {
                await expect400(() => validateBody(LoginDto, { ...valid, [field]: value }));
            });
        }
    }

    for (const workEmail of ['invalid', '   ', 'a..b@example.com', 'a@example', 'é@example.com']) {
        it(`rejects invalid email ${JSON.stringify(workEmail)}`, async () => {
            await expect400(() => validateBody(LoginDto, { ...valid, workEmail }));
        });
    }

    it('rejects unknown properties', async () => {
        await expect400(() => validateBody(LoginDto, { ...valid, role: 'admin' }));
    });

    it('preserves the normalized email length boundary and existing email format', async () => {
        const workEmail = 'a'.repeat(64) + '@' + 'b'.repeat(63) + '.' + 'c'.repeat(63) + '.' + 'd'.repeat(57) + '.com';
        assert.equal(workEmail.length, 254);
        assert.equal((await validateBody(LoginDto, { ...valid, workEmail: ` ${workEmail.toUpperCase()} ` })).workEmail, workEmail);
        await expect400(() => validateBody(LoginDto, { ...valid, workEmail: 'a' + workEmail }));
    });

    it('preserves the exact 1024 and 1025 UTF-8 byte boundaries for ASCII and Unicode', async () => {
        for (const password of ['a'.repeat(1024), '😀'.repeat(256)]) {
            assert.equal(Buffer.byteLength(password, 'utf8'), 1024);
            assert.equal((await validateBody(LoginDto, { ...valid, password })).password, password);
            const oversized = password + 'a';
            assert.equal(Buffer.byteLength(oversized, 'utf8'), 1025);
            await expect400(() => validateBody(LoginDto, { ...valid, password: oversized }));
        }
    });

    it('preserves whitespace-only passwords without introducing a password policy', async () => {
        assert.equal((await validateBody(LoginDto, { ...valid, password: '   ' })).password, '   ');
    });
});

describe('Question DTO', () => {
    for (const [name, body] of [
        ['missing question', {}], ['null question', { question: null }],
        ['empty question', { question: '' }], ['whitespace question', { question: ' \t\n ' }],
        ['numeric question', { question: 42 }], ['boolean question', { question: false }],
        ['array question', { question: ['test'] }], ['object question', { question: { value: 'test' } }],
        ['unknown properties', { question: 'test', employeeId: fixtures.EMPLOYEE_ID }],
    ]) {
        it(`rejects ${name}`, async () => {
            await expect400(() => validateBody(AskQuestionDto, body));
        });
    }

    it('trims the question and returns a DTO instance', async () => {
        const result = await validateBody(AskQuestionDto, { question: ' \tTest question\n ' });
        assert.ok(result instanceof AskQuestionDto);
        assert.equal(result.question, 'Test question');
    });

    it('preserves the normalized 4000 and 4001 UTF-16 length boundaries', async () => {
        for (const question of ['a'.repeat(4000), '😀'.repeat(2000)]) {
            assert.equal(question.length, 4000);
            assert.equal((await validateBody(AskQuestionDto, { question: ` ${question} ` })).question, question);
            await expect400(() => validateBody(AskQuestionDto, { question: question + 'a' }));
        }
    });
});

describe('JWT environment validation', () => {
    it('accepts configured values and parses the TTL', () => {
        const result = validateEnvironment({ ...fixtures.environment(), JWT_EXPIRES_IN_SECONDS: String(fixtures.TTL) });
        assert.equal(result.JWT_EXPIRES_IN_SECONDS, fixtures.TTL);
        assert.ok(result.JWT_SECRET === fixtures.JWT_SECRET);
    });

    for (const key of ['JWT_SECRET', 'JWT_EXPIRES_IN_SECONDS']) {
        it(`rejects missing ${key}`, () => {
            const env = fixtures.environment();
            delete env[key];
            assert.throws(() => validateEnvironment(env));
        });
    }

    it('rejects short or whitespace-only secrets', () => {
        for (const secret of ['short', ' '.repeat(32)]) {
            assert.throws(() => validateEnvironment({ ...fixtures.environment(), JWT_SECRET: secret }));
        }
    });

    for (const value of ['0', '-1', '1.5', 'invalid']) {
        it(`rejects invalid TTL ${value}`, () => {
            assert.throws(() => validateEnvironment({ ...fixtures.environment(), JWT_EXPIRES_IN_SECONDS: value }));
        });
    }
});

describe('PasswordService', () => {
    const passwords = new PasswordService();
    let hash;
    before(async () => { hash = await passwords.hash(fixtures.PASSWORD); });

    it('verifies the correct password and rejects the wrong password', async () => {
        assert.equal(await passwords.verify(fixtures.PASSWORD, hash), true);
        assert.equal(await passwords.verify('Wrong-Test-Password', hash), false);
    });

    it('uses a fresh salt for the same password', async () => {
        assert.ok(await passwords.hash(fixtures.PASSWORD) !== hash);
    });

    it('treats whitespace and case as significant', async () => {
        assert.equal(await passwords.verify(fixtures.PASSWORD.trim(), hash), false);
        assert.equal(await passwords.verify(fixtures.PASSWORD.toLowerCase(), hash), false);
    });

    it('rejects malformed hashes and unsupported parameters before deriving a key', async t => {
        const derive = t.mock.method(passwords, 'deriveKey', async () => {
            throw new Error('Malformed hashes must not start scrypt work');
        });
        for (const stored of ['', 'invalid', hash.slice(1), hash.replace('v1$', 'v2$'), hash.replace('$32768$', '$99999$'), hash.replace('$8$', '$9$'), hash.replace('$3$', '$4$'), hash.slice(0, -1) + 'z']) {
            assert.equal(await passwords.verify(fixtures.PASSWORD, stored), false);
        }
        assert.equal(derive.mock.callCount(), 0);
    });

    it('warms and reuses the real dummy verification path', async t => {
        const dummy = new PasswordService();
        const hashing = t.mock.method(dummy, 'hash');
        const verification = t.mock.method(dummy, 'verify');
        await dummy.onModuleInit();
        await dummy.verifyDummy(fixtures.PASSWORD);
        await dummy.verifyDummy('Another-Test-Password');
        assert.equal(hashing.mock.callCount(), 1);
        assert.equal(verification.mock.callCount(), 2);
    });
});

describe('AuthService login and JWT generation', () => {
    const passwords = new PasswordService();
    const jwt = fixtures.jwtService();
    let hash;
    before(async () => { hash = await passwords.hash(fixtures.PASSWORD); });

    function repository(credentials = { id: fixtures.EMPLOYEE_ID, passwordHash: hash, employmentStatus: 'active' }) {
        return { async findCredentialsByWorkEmail(email) {
            assert.equal(email, fixtures.EMAIL);
            return credentials;
        } };
    }

    it('returns a minimal HS256 token and the configured expiration', async () => {
        const auth = new AuthService(repository(), passwords, jwt, fixtures.config());
        const result = await auth.login({ workEmail: fixtures.EMAIL, password: fixtures.PASSWORD });
        assert.equal(result.tokenType, 'Bearer');
        assert.equal(result.expiresIn, fixtures.TTL);
        assert.deepEqual(Object.keys(result).sort(), ['accessToken', 'expiresIn', 'tokenType']);
        const verified = jwt.verify(result.accessToken, { algorithms: ['HS256'], complete: true });
        assert.equal(verified.header.alg, 'HS256');
        assert.equal(verified.payload.sub, fixtures.EMPLOYEE_ID);
        assert.ok(Number.isInteger(verified.payload.iat));
        assert.ok(Number.isInteger(verified.payload.exp));
        assert.equal(verified.payload.exp - verified.payload.iat, fixtures.TTL);
        assert.deepEqual(Object.keys(verified.payload).sort(), ['exp', 'iat', 'sub']);
    });

    for (const [name, credentials, password, dummyCalls] of [
        ['unknown email', null, fixtures.PASSWORD, 1],
        ['unprovisioned employee', { id: fixtures.EMPLOYEE_ID, passwordHash: null, employmentStatus: 'active' }, fixtures.PASSWORD, 1],
        ['wrong password', undefined, 'Wrong-Test-Password', 0],
        ['inactive employee', { id: fixtures.EMPLOYEE_ID, get passwordHash() { return hash; }, employmentStatus: 'inactive' }, fixtures.PASSWORD, 0],
    ]) {
        it(`returns the same generic 401 for ${name}`, async t => {
            const dummy = t.mock.method(passwords, 'verifyDummy');
            const auth = new AuthService(repository(credentials), passwords, jwt, fixtures.config());
            await expect401(() => auth.login({ workEmail: fixtures.EMAIL, password }), new UnauthorizedException('Invalid credentials.').getResponse());
            assert.equal(dummy.mock.callCount(), dummyCalls);
        });
    }

    it('propagates repository failures unchanged', async () => {
        const error = new Error('Fake repository failure');
        const auth = new AuthService({ async findCredentialsByWorkEmail() { throw error; } }, passwords, jwt, fixtures.config());
        await assert.rejects(auth.login({ workEmail: fixtures.EMAIL, password: fixtures.PASSWORD }), actual => actual === error);
    });

    it('propagates unexpected hashing and signing failures unchanged', async t => {
        const error = new Error('Fake infrastructure failure');
        t.mock.method(passwords, 'verify', async () => { throw error; });
        const auth = new AuthService(repository(), passwords, jwt, fixtures.config());
        await assert.rejects(auth.login({ workEmail: fixtures.EMAIL, password: fixtures.PASSWORD }), actual => actual === error);
        t.mock.restoreAll();
        t.mock.method(jwt, 'signAsync', async () => { throw error; });
        await assert.rejects(auth.login({ workEmail: fixtures.EMAIL, password: fixtures.PASSWORD }), actual => actual === error);
    });
});

describe('AuthGuard', () => {
    const jwt = fixtures.jwtService();
    function setup(employee = { id: fixtures.EMPLOYEE_ID, employmentStatus: 'active', role: 'employee' }) {
        const calls = [];
        const repository = { async findAuthenticatedEmployeeById(id) { calls.push(id); return employee; } };
        return { guard: new AuthGuard(jwt, fixtures.config(), repository), calls };
    }
    function request(token = jwt.sign({ sub: fixtures.EMPLOYEE_ID })) {
        return { headers: { authorization: `Bearer ${token}` } };
    }
    function claims() {
        const now = Math.floor(Date.now() / 1000);
        return { sub: fixtures.EMPLOYEE_ID, iat: now, exp: now + fixtures.TTL };
    }

    it('rejects missing, malformed, wrong-scheme and multiple Authorization values', async () => {
        const { guard, calls } = setup();
        for (const authorization of [undefined, '', 'Basic abc', 'bearer abc', 'Bearer', 'Bearer ', 'Bearer  abc', ' Bearer abc', 'Bearer abc ', 'Bearer abc,def', ['Bearer abc', 'Bearer def'], request().headers.authorization + '\n']) {
            await expect401(() => guard.canActivate(fixtures.context({ headers: { authorization } })));
        }
        await expect401(() => guard.canActivate(fixtures.context({ ...request(), rawHeaders: ['Authorization', 'one', 'authorization', 'two'] })));
        assert.deepEqual(calls, []);
    });

    it('rejects tampered, wrong-secret, expired and non-HS256 tokens', async () => {
        const { guard, calls } = setup();
        const parts = jwt.sign({ sub: fixtures.EMPLOYEE_ID }).split('.');
        parts[2] = (parts[2][0] === 'a' ? 'b' : 'a') + parts[2].slice(1);
        for (const token of [parts.join('.'), fixtures.signPayload(claims(), 'HS256', 'FAKE-DIFFERENT-TEST-SECRET-NEVER-PRODUCTION'), jwt.sign({ sub: fixtures.EMPLOYEE_ID }, { expiresIn: -1 }), fixtures.signPayload(claims(), 'HS384'), fixtures.signPayload(claims(), 'HS512'), fixtures.signPayload(claims(), 'none')]) {
            await expect401(() => guard.canActivate(fixtures.context(request(token))));
        }
        assert.deepEqual(calls, []);
    });

    it('rejects missing, malformed, fractional and additional claims', async () => {
        const { guard, calls } = setup();
        const payloads = [{ ...claims(), sub: 'invalid' }, { ...claims(), role: 'admin' }, { ...claims(), email: fixtures.EMAIL }, [], 'invalid-payload'];
        for (const key of ['sub', 'iat', 'exp']) {
            const missing = claims(); delete missing[key]; payloads.push(missing);
        }
        for (const key of ['iat', 'exp']) {
            for (const value of ['123', null, Math.floor(Date.now() / 1000) + fixtures.TTL + 0.5, true, {}, Infinity, NaN]) {
                const payload = { ...claims(), [key]: value };
                assert.equal(jwtPayloadSchema.safeParse(payload).success, false);
                payloads.push(payload);
            }
        }
        for (const payload of payloads) await expect401(() => guard.canActivate(fixtures.context(request(fixtures.signPayload(payload)))));
        assert.deepEqual(calls, []);
    });

    it('returns 401 for a signed null payload rather than leaking the verifier TypeError', async () => {
        const { guard, calls } = setup();
        await expect401(() => guard.canActivate(fixtures.context(request(fixtures.signPayload(null)))));
        assert.deepEqual(calls, []);
    });

    it('attaches verified employeeId and repository role, ignoring client identity and preexisting user', async () => {
        const { guard, calls } = setup();
        const incoming = { ...request(), user: { employeeId: fixtures.OTHER_EMPLOYEE_ID }, body: { employeeId: fixtures.OTHER_EMPLOYEE_ID }, query: { employeeId: fixtures.OTHER_EMPLOYEE_ID }, params: { employeeId: fixtures.OTHER_EMPLOYEE_ID } };
        assert.equal(await guard.canActivate(fixtures.context(incoming)), true);
        assert.deepEqual(incoming.user, { employeeId: fixtures.EMPLOYEE_ID, role: 'employee' });
        assert.deepEqual(calls, [fixtures.EMPLOYEE_ID]);
    });

    for (const [name, employee] of [['nonexistent', null], ['inactive', { id: fixtures.EMPLOYEE_ID, employmentStatus: 'inactive' }]]) {
        it(`rejects ${name} employees`, async () => {
            const { guard } = setup(employee);
            const incoming = { ...request(), user: { employeeId: fixtures.OTHER_EMPLOYEE_ID } };
            await expect401(() => guard.canActivate(fixtures.context(incoming)));
            assert.equal(incoming.user, undefined);
        });
    }

    it('propagates database, configuration and unexpected verification failures', async () => {
        const error = new Error('Fake database failure');
        const repository = { async findAuthenticatedEmployeeById() { throw error; } };
        await assert.rejects(new AuthGuard(jwt, fixtures.config(), repository).canActivate(fixtures.context(request())), actual => actual === error);
        const configurationError = new Error('Fake missing configuration');
        const missingConfig = { getOrThrow() { throw configurationError; } };
        await assert.rejects(new AuthGuard(jwt, missingConfig, repository).canActivate(fixtures.context(request())), actual => actual === configurationError);
        const unexpected = new TypeError('Fake programming failure');
        const verifier = { async verifyAsync() { throw unexpected; } };
        await assert.rejects(new AuthGuard(verifier, fixtures.config(), repository).canActivate(fixtures.context(request())), actual => actual === unexpected);
    });

    it('does not log Authorization or JWT values', async t => {
        const logs = [];
        for (const target of [console, Logger.prototype]) {
            for (const key of ['log', 'warn', 'error', 'debug', 'verbose']) {
                if (typeof target[key] === 'function') t.mock.method(target, key, () => logs.push(key));
            }
        }
        const { guard } = setup();
        await guard.canActivate(fixtures.context(request()));
        await expect401(() => guard.canActivate(fixtures.context(request('invalid'))));
        assert.deepEqual(logs, []);
    });
});

describe('CurrentUser', () => {
    class Controller { handler() {} }
    CurrentUser()(Controller.prototype, 'handler', 0);
    const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, Controller, 'handler');
    const factory = Object.values(metadata)[0].factory;

    it('returns the attached user without reading headers or client identity', () => {
        const user = { employeeId: fixtures.EMPLOYEE_ID };
        const request = { user, get headers() { throw new Error('Unexpected header access'); }, body: { employeeId: fixtures.OTHER_EMPLOYEE_ID } };
        assert.equal(factory(undefined, fixtures.context(request)), user);
    });

    it('raises the internal wiring error when no user is attached', () => {
        assert.throws(() => factory(undefined, fixtures.context({})), error => error instanceof InternalServerErrorException && error.getStatus() === 500);
    });
});
