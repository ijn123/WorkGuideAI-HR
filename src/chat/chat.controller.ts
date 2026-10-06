import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { ChatService } from './chat.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
    askQuestionSchema,
    type AskQuestionDto,
} from './dto/requests/ask-question.dto';
import type {
    AskQuestionResponseDto,
} from './dto/responses/ask-question-response.dto';

@Controller('chat')
@UseGuards(AuthGuard)
export class ChatController {
    constructor(private readonly chatService: ChatService) {}

    @Post()
    async ask(
        @Body(new ZodValidationPipe(askQuestionSchema))
        body: AskQuestionDto,
    ): Promise<AskQuestionResponseDto> {
        const result = await this.chatService.ask(body.question);

        return {
            question: result.question,
            answer: result.answer,
        };
    }
}
