import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import {ChatModule} from "./chat/chat.module";
import {ConfigModule} from "@nestjs/config";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        ChatModule,
    ],
    controllers: [AppController],
    providers: [],
})
export class AppModule {}