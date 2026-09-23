import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import {ChatModule} from "./chat/chat.module";
import {ConfigModule} from "@nestjs/config";
import { DatabaseModule } from './database/database.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        ChatModule,
        DatabaseModule,
    ],
    controllers: [AppController],
    providers: [],
})
export class AppModule {}