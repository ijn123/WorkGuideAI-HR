import {
    Injectable,
    Logger,
    ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatGoogle } from '@langchain/google';
import { StringOutputParser } from '@langchain/core/output_parsers';

@Injectable()
export class GeminiService {
    private readonly logger = new Logger(GeminiService.name);
    private readonly model: ChatGoogle;

    constructor(private readonly config: ConfigService) {
        const apiKey = this.config
            .getOrThrow<string>('GEMINI_API_KEY')
            .trim();

        const modelName = this.config
            .getOrThrow<string>('GEMINI_CHAT_MODEL')
            .trim();

        if (!apiKey || !modelName) {
            throw new Error(
                'Заполните GEMINI_API_KEY и GEMINI_CHAT_MODEL в .env.',
            );
        }

        this.model = new ChatGoogle({
            apiKey,
            model: modelName,
            maxRetries: 1,
        });
    }

    async ask(question: string): Promise<string> {
        try {
            const chain = this.model.pipe(new StringOutputParser());
            const answer = await chain.invoke(question);

            if (!answer.trim()) {
                throw new Error('Empty model response');
            }

            return answer;
        } catch {
            this.logger.warn('Не удалось получить ответ от Gemini.');

            throw new ServiceUnavailableException(
                'AI-сервис временно недоступен. Попробуйте позже.',
            );
        }
    }
}
