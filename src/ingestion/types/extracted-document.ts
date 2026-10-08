/**
 * Текст одной страницы или логической части документа.
 */
export interface ExtractedDocumentPart {
    text: string;

    /**
     * Номер страницы, начиная с 1.
     * null, если формат не предоставляет достоверную нумерацию.
     */
    pageNumber: number | null;
}

/**
 * Результат извлечения текста из загруженного файла.
 */
export interface ExtractedDocument {
    parts: ExtractedDocumentPart[];
}
