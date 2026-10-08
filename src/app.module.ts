import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { ChatModule } from './chat/chat.module';
import { DatabaseModule } from './database/database.module';
import { EmployeesModule } from './employees/employees.module';
import { HrModule } from './hr/hr.module';
import { DocumentsModule } from './documents/documents.module';
import { AuthModule } from './auth/auth.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { validateEnvironment } from './config/env.schema';

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
        AuthModule,
        IngestionModule,
    ],
    controllers: [AppController],
    providers: [],
})
export class AppModule {}