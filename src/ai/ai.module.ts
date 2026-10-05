import { Module } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { AI_CHAT } from './interfaces/ai-chat.interface';

@Module({
    providers: [
        GeminiService,
        {
            provide: AI_CHAT,
            useExisting: GeminiService,
        },
    ],
    exports: [AI_CHAT],
})
export class AiModule {}