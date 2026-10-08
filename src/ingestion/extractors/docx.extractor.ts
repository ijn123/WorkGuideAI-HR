import { BadRequestException, Injectable } from '@nestjs/common';
import * as mammoth from 'mammoth';
import type {
    ExtractedDocument,
} from '../types/extracted-document';

@Injectable()
export class DocxExtractor {
    /**
     * Извлекает обычный текст из DOCX.
     *
     * @throws {@link BadRequestException}
     * Если документ не удалось прочитать или он не содержит текста.
     *
     * @remarks
     * Номера страниц не определяются.
     * Текст внутри изображений не распознаётся.
     */
    async extract(buffer: Buffer): Promise<ExtractedDocument> {
        let text: string;

        try {
            const result = await mammoth.extractRawText({ buffer });

            if (result.messages.some((message) => message.type === 'error')) {
                throw new Error('Document extraction failed');
            }

            text = result.value;
        } catch {
            throw new BadRequestException(
                'Не удалось прочитать DOCX-файл. Проверьте формат и целостность документа.',
            );
        }

        text = text.replace(/\r\n?/g, '\n').trim();

        if (!text) {
            throw new BadRequestException(
                'DOCX-файл не содержит доступного для извлечения текста.',
            );
        }

        return {
            parts: [
                {
                    text,
                    pageNumber: null,
                },
            ],
        };
    }
}
