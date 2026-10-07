export const AI_CHAT = Symbol('AI_CHAT');

export interface AiChatInterface {
    /**
     * Передаёт вопрос языковой модели и возвращает текст ответа.
     *
     * @param question - Вопрос пользователя.
     * @returns Ответ модели.
     *
     * @remarks
     * Этот метод не выполняет поиск по документам
     * или запросы к HR-базе.
     */
    ask(question: string): Promise<string>;
}