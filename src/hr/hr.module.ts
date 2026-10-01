import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { HrController } from './hr.controller';
import { HrRepository } from './hr.repository';
import { HrRequestsService } from './hr-requests.service';
import {
    HR_REQUESTS_REPOSITORY,
} from './interfaces/hr-requests-repository.interface';
import { LeaveBalancesService } from './leave-balances.service';
import {
    LEAVE_BALANCES_REPOSITORY,
} from './interfaces/leave-balances-repository.interface';
import { OnboardingTasksService } from './onboarding-tasks.service';
import {
    ONBOARDING_TASKS_REPOSITORY,
} from './interfaces/onboarding-tasks-repository.interface';


@Module({
    imports: [DatabaseModule],
    controllers: [HrController],
    providers: [
        HrRequestsService,
        LeaveBalancesService,
        OnboardingTasksService,
        HrRepository,
        {
            provide: HR_REQUESTS_REPOSITORY,
            useExisting: HrRepository,
        },
        {
            provide: LEAVE_BALANCES_REPOSITORY,
            useExisting: HrRepository,
        },
        {
            provide: ONBOARDING_TASKS_REPOSITORY,
            useExisting: HrRepository,
        },
    ],
    exports: [
        HrRequestsService,
        LeaveBalancesService,
        OnboardingTasksService,
    ],
})
export class HrModule {}
