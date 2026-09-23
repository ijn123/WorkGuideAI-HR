import { Injectable } from '@nestjs/common';
import { GeminiService } from '../ai/gemini.service';

@Injectable()
export class ChatService {
    constructor(private readonly geminiService: GeminiService) {}

    async ask(question: string) {
        const answer = await this.geminiService.ask(question);

        return {
            question,
            answer,
        };
    }
}