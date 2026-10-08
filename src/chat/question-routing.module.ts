import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QuestionRouterService } from './question-router.service';
import { QUESTION_ROUTER } from './interfaces/question-router.interface';
import { HrModule } from '../hr/hr.module';
import { HrOperationExecutorService } from './hr-operation-executor.service';
import { HR_OPERATION_EXECUTOR } from './interfaces/hr-operation-executor.interface';
import { DocumentRagModule } from './document-rag.module';
import { QuestionOrchestratorService } from './question-orchestrator.service';
import { QUESTION_ORCHESTRATOR } from './interfaces/question-orchestrator.interface';

@Module({
    imports: [
        ConfigModule,
        HrModule,
        DocumentRagModule,
    ],
    providers: [
        {
            provide: QUESTION_ROUTER,
            useClass: QuestionRouterService,
        },
        {
            provide: HR_OPERATION_EXECUTOR,
            useClass: HrOperationExecutorService,
        },
        {
            provide: QUESTION_ORCHESTRATOR,
            useClass: QuestionOrchestratorService,
        },
    ],
    exports: [
        QUESTION_ROUTER,
        HR_OPERATION_EXECUTOR,
        QUESTION_ORCHESTRATOR,
    ],
})
export class QuestionRoutingModule {}
