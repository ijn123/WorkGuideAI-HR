import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { QuestionRoutingModule } from './question-routing.module';

@Module({
    imports: [QuestionRoutingModule, AuthModule],
    controllers: [ChatController],
    providers: [ChatService],
})
export class ChatModule {}
