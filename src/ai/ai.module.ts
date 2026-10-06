import { Module } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { AI_CHAT } from './interfaces/ai-chat.interface';
import { EmbeddingsService } from './embeddings.service';
import { EMBEDDINGS } from './interfaces/embeddings.interface';

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
    ],
    exports: [AI_CHAT, EMBEDDINGS],
})
export class AiModule {}