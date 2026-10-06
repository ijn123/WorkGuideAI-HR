import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { AiModule } from '../ai/ai.module';

@Module({
    imports: [AiModule, AuthModule],
    controllers: [ChatController],
    providers: [ChatService],
})
export class ChatModule {}
