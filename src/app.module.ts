import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import {ChatModule} from "./chat/chat.module";
import {ConfigModule} from "@nestjs/config";
import { DatabaseModule } from './database/database.module';
import { EmployeesModule } from './employees/employees.module';
import { HrModule } from './hr/hr.module';
import { DocumentsModule } from './documents/documents.module';
import { validateEnvironment } from './config/env.schema';
import { IngestionModule } from './ingestion/ingestion.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            validate: validateEnvironment,
        }),
        ChatModule,
        DatabaseModule,
        EmployeesModule,
        HrModule,
        DocumentsModule,
        IngestionModule,
    ],
    controllers: [AppController],
    providers: [],
})
export class AppModule {}