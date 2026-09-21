import { Body, Controller, Post } from '@nestjs/common';
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
export class ChatController {
    constructor(private readonly chatService: ChatService) {}

    @Post()
    ask(
        @Body(new ZodValidationPipe(askQuestionSchema))
        body: AskQuestionDto,
    ): AskQuestionResponseDto {
        const result = this.chatService.ask(body.question);

        return {
            question: result.question,
            answer: result.answer,
        };
    }
}