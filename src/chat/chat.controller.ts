import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ChatService } from './chat.service';
import { AskQuestionDto } from './dto/requests/ask-question.dto';
import type {
    AskQuestionResponseDto,
} from './dto/responses/ask-question-response.dto';

@Controller('chat')
@UseGuards(AuthGuard)
export class ChatController {
    constructor(private readonly chatService: ChatService) {}

    @Post()
    ask(
        @Body()
        body: AskQuestionDto,
        @CurrentUser()
        currentUser: AuthenticatedUser,
    ): Promise<AskQuestionResponseDto> {
        return this.chatService.ask(body.question, currentUser);
    }
}