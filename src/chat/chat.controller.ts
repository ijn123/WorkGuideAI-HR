import {
    BadRequestException,
    Body,
    Controller,
    Post,
} from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
    constructor(private readonly chatService: ChatService) {}

    @Post()
    ask(@Body() body: { question?: unknown } | undefined) {
        const question = body?.question;

        if (typeof question !== 'string' || !question.trim()) {
            throw new BadRequestException(
                'Поле question должно содержать непустую строку.',
            );
        }

        return this.chatService.ask(question.trim());
    }
}
