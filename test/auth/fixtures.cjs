require('reflect-metadata');
const { ConfigService } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt');

const EMPLOYEE_ID = '8f1c3b24-1234-4567-89ab-123456789abc';
const OTHER_EMPLOYEE_ID = '1f1c3b24-1234-4567-89ab-123456789abc';
const EMAIL = 'employee@example.invalid';
const PASSWORD = '  Fictional-Test-Password  ';
const JWT_SECRET = 'FAKE-TEST-ONLY-JWT-SECRET-NEVER-USE-IN-PRODUCTION';
const TTL = 3600;

function environment() {
    return {
        DB_HOST: '127.0.0.1',
        DB_PORT: 5432,
        DB_NAME: 'fake_test_database',
        DB_USER: 'fake_test_reader',
        DB_PASSWORD: 'FAKE-TEST-ONLY-NOT-A-DATABASE-CREDENTIAL',
        JWT_SECRET,
        JWT_EXPIRES_IN_SECONDS: TTL,
        GEMINI_API_KEY: 'FAKE-TEST-ONLY-NOT-AN-API-KEY',
        GEMINI_CHAT_MODEL: 'gemini-2.5-flash',
    };
}

function config() {
    return new ConfigService(environment());
}

function jwtService() {
    return new JwtService({
        secret: JWT_SECRET,
        signOptions: { algorithm: 'HS256', expiresIn: TTL },
    });
}

// Signing raw JSON through the library allows invalid claim fixtures without
// copying production signature or verification logic into the tests.
function signPayload(payload, algorithm = 'HS256', secret = JWT_SECRET) {
    return new JwtService({ secret }).sign(
        Buffer.from(JSON.stringify(payload)),
        { algorithm, header: { alg: algorithm, typ: 'JWT' } },
    );
}

function context(request) {
    return { switchToHttp: () => ({ getRequest: () => request }) };
}

module.exports = {
    EMPLOYEE_ID, OTHER_EMPLOYEE_ID, EMAIL, PASSWORD, JWT_SECRET, TTL,
    environment, config, jwtService, signPayload, context,
};
