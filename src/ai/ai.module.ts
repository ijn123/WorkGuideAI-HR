import { Module } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { AI_CHAT } from './interfaces/ai-chat.interface';
import { EmbeddingsService } from './embeddings.service';
import { EMBEDDINGS } from './interfaces/embeddings.interface';
import { GroundedAnswerService } from './grounded-answer.service';
import { GROUNDED_ANSWER } from './interfaces/grounded-answer.interface';

@Module({
    providers: [
        GeminiService,
        {
            provide: AI_CHAT,
            useExisting: GeminiService,
        },
        {
            provide: EMBEDDINGS,
            useClass: EmbeddingsService,
        },
        {
            provide: GROUNDED_ANSWER,
            useClass: GroundedAnswerService,
        },
    ],
    exports: [AI_CHAT, EMBEDDINGS, GROUNDED_ANSWER,],
})
export class AiModule {}