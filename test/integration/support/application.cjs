require('reflect-metadata');
const { randomBytes } = require('node:crypto');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const { ConfigModule } = require('@nestjs/config');
const { DatabaseService } = require('../../../dist/database/database.service');
const { validateEnvironment } = require('../../../dist/config/env.schema');
const { connectionConfig, assertDatabaseIdentity } = require('./database.cjs');

async function createTestApplication(context, imports) {
    const connection = connectionConfig(context, 'application');
    const values = validateEnvironment({
        DB_HOST: connection.host, DB_PORT: connection.port, DB_NAME: connection.database,
        DB_USER: connection.user, DB_PASSWORD: connection.password, DB_SSL: 'false',
        JWT_SECRET: randomBytes(32).toString('hex'), JWT_EXPIRES_IN_SECONDS: 900,
        // Synthetic settings only; chat tests replace external SDKs before importing ChatModule.
        GEMINI_API_KEY: randomBytes(32).toString('hex'), GEMINI_CHAT_MODEL: 'unused-integration-model',
        GEMINI_EMBEDDING_MODEL: 'unused-integration-model', GEMINI_EMBEDDING_DIMENSIONS: 8,
        QDRANT_URL: 'http://127.0.0.1:1', QDRANT_COLLECTION: 'unused-integration-collection',
    });
    let moduleRef;
    let app;
    try {
        moduleRef = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true, ignoreEnvFile: true, ignoreEnvVars: true,
                    skipProcessEnv: true, load: [() => values],
                }),
                ...imports,
            ],
        }).compile();
        app = moduleRef.createNestApplication({ logger: false });
        app.useGlobalPipes(new ValidationPipe({
            transform: true, whitelist: true, forbidNonWhitelisted: true,
        }));
        // Verify the actual production pool, without replacing its query method.
        const service = app.get(DatabaseService);
        await assertDatabaseIdentity({ query: async sql => ({ rows: await service.query(sql) }) }, context, 'application');
        await app.init();
        return app;
    } catch {
        try {
            if (app) await app.close();
            else if (moduleRef) await moduleRef.close();
        } finally {
            throw new Error('Could not initialize the isolated NestJS testing application.');
        }
    }
}

module.exports = { createTestApplication };
