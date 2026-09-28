import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { HrController } from './hr.controller';
import { HrService } from './hr.service';
import { HrRepository } from './hr.repository';

@Module({
    imports: [DatabaseModule],
    controllers: [HrController],
    providers: [HrService, HrRepository],
    exports: [HrService],
})
export class HrModule {}
