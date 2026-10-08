import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { ServiceUnavailableException } from '@nestjs/common';
import { QuestionOrchestratorService } from '../src/chat/question-orchestrator.service';
import type { AuthenticatedUser } from '../src/auth/types/authenticated-user';
import type { QuestionRoutingDecision } from '../src/chat/schemas/question-routing.schema';
import type { DocumentRagResult } from '../src/chat/interfaces/document-rag.interface';

async function main(): Promise<void> {
    const user: AuthenticatedUser = {
        employeeId: '10000000-0000-4000-8000-000000000001',
        role: 'employee' as AuthenticatedUser['role'],
    };

    let decision: QuestionRoutingDecision = {
        route: 'CLARIFICATION',
        question: 'За какой год нужен баланс?',
    };

    let documentCalls = 0;
    let hrCalls = 0;
    let documentError: Error | undefined;

    const documentResult: DocumentRagResult = {
        answer: 'Подайте заявку через HR-портал [S1].',
        insufficientInformation: false,
        sources: [{
            sourceId: 'S1',
            documentId: '50000000-0000-4000-8000-000000000027',
            generationId: '70000000-0000-4000-8000-000000000001',
            chunkId: '60000000-0000-4000-8000-000000000001',
            title: 'Demo policy',
            pageNumber: null,
        }],
    };

    const orchestrator = new QuestionOrchestratorService(
        {
            route: async () => decision,
        },
        {
            execute: async (operation, authenticatedUser) => {
                hrCalls++;
                assert.strictEqual(authenticatedUser, user);
                assert.equal(operation.operation, 'HR_REQUESTS');

                return {
                    operation: 'HR_REQUESTS',
                    status: 'SUCCESS',
                    data: [],
                };
            },
        },
        {
            ask: async (input) => {
                documentCalls++;
                assert.equal(input.role, user.role);

                if (documentError) {
                    throw documentError;
                }

                return documentResult;
            },
        },
    );

    const clarification = await orchestrator.ask('Мой отпуск?', user);

    assert.deepEqual(clarification, decision);
    assert.equal(documentCalls, 0);
    assert.equal(hrCalls, 0);
    console.log('Уточнение не вызывает источники: OK');

    decision = { route: 'DOCUMENTS' };

    const documents = await orchestrator.ask(
        'Как подать заявку на отпуск?',
        user,
    );

    assert.deepEqual(documents, {
        route: 'DOCUMENTS',
        documents: {
            status: 'SUCCESS',
            data: documentResult,
        },
    });
    assert.equal(documentCalls, 1);
    assert.equal(hrCalls, 0);
    console.log('DOCUMENTS сохраняет ответ и источники: OK');

    decision = {
        route: 'SQL',
        operations: [{ operation: 'HR_REQUESTS' }],
    };

    const sql = await orchestrator.ask('Покажи мои заявки.', user);

    assert.deepEqual(sql, {
        route: 'SQL',
        hr: [{
            operation: 'HR_REQUESTS',
            status: 'SUCCESS',
            data: [],
        }],
    });
    assert.equal(documentCalls, 1);
    assert.equal(hrCalls, 1);
    console.log('SQL вызывает только HR-источник: OK');

    decision = {
        route: 'HYBRID',
        operations: [{ operation: 'HR_REQUESTS' }],
    };

    const hybrid = await orchestrator.ask(
        'Покажи мои заявки и объясни порядок их подачи.',
        user,
    );

    assert.deepEqual(hybrid, {
        route: 'HYBRID',
        documents: {
            status: 'SUCCESS',
            data: documentResult,
        },
        hr: [{
            operation: 'HR_REQUESTS',
            status: 'SUCCESS',
            data: [],
        }],
    });
    assert.equal(documentCalls, 2);
    assert.equal(hrCalls, 2);
    console.log('HYBRID объединяет оба источника: OK');

    documentError = new ServiceUnavailableException();

    const partial = await orchestrator.ask(
        'Покажи мои заявки и объясни правила.',
        user,
    );

    assert.deepEqual(partial, {
        route: 'HYBRID',
        documents: {
            status: 'UNAVAILABLE',
        },
        hr: [{
            operation: 'HR_REQUESTS',
            status: 'SUCCESS',
            data: [],
        }],
    });
    assert.equal(documentCalls, 3);
    assert.equal(hrCalls, 3);
    console.log('HYBRID сохраняет HR-результат при недоступности RAG: OK');

    documentError = undefined;

    const documentCallsBefore = documentCalls;
    const hrCallsBefore = hrCalls;

    // Deliberately bypass static types to test runtime validation.
    const invalidDecisions = [
        {
            route: 'SQL',
            operations: [{
                operation: 'EXECUTE_SQL',
                sql: 'SELECT * FROM employees',
            }],
        },
        {
            route: 'SQL',
            operations: [{
                operation: 'HR_REQUESTS',
                employeeId: '10000000-0000-4000-8000-000000000002',
            }],
        },
        {
            route: 'DOCUMENTS',
            role: 'admin',
        },
        {
            route: 'UNKNOWN',
        },
    ];

    for (const invalid of invalidDecisions) {
        decision = invalid as unknown as QuestionRoutingDecision;

        await assert.rejects(() =>
            orchestrator.ask('Проверочный вопрос', user),
        );
    }

    assert.equal(documentCalls, documentCallsBefore);
    assert.equal(hrCalls, hrCallsBefore);
    console.log('Недопустимые решения не вызывают источники: OK');

    decision = { route: 'DOCUMENTS' };
    documentError = new Error('Unexpected test failure');

    await assert.rejects(
        () => orchestrator.ask('Проверочный вопрос', user),
        (error: unknown) => error === documentError,
    );

    console.log('Неожиданная ошибка не скрывается: OK');
}

main().catch((error: unknown) => {
    console.error(
        'Ошибка проверки:',
        error instanceof Error ? error.message : 'Неизвестная ошибка',
    );
    process.exitCode = 1;
});