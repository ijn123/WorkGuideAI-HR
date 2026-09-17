import { Injectable } from '@nestjs/common';

@Injectable()
export class ChatService {
    ask(question: string) {
        return {
            question,
            answer: 'Вопрос получен. Gemini пока не подключён.',
        };
    }
}