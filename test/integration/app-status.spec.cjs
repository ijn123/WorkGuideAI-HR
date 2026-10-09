require('reflect-metadata');
const request = require('supertest');
const { Module } = require('@nestjs/common');
const { AppController } = require('../../dist/app.controller');
const { DatabaseModule } = require('../../dist/database/database.module');
const { createTestApplication } = require('./support/application.cjs');
const { readContext } = require('./support/database.cjs');

class StatusTestModule {}
Module({ imports: [DatabaseModule], controllers: [AppController] })(StatusTestModule);

describe('GET / application status', () => {
    let app;

    beforeAll(async () => {
        app = await createTestApplication(readContext(), [StatusTestModule]);
    });

    afterAll(async () => { await app?.close(); });

    test('returns the complete public status response without authentication', async () => {
        const response = await request(app.getHttpServer()).get('/');
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ name: 'WorkGuide AI', status: 'ok', description: 'HR-ассистент' });
    });
});
