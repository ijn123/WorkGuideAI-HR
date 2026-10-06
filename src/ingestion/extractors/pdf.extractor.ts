import { BadRequestException, Injectable } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import type {
    ExtractedDocument,
} from '../types/extracted-document';

@Injectable()
export class PdfExtractor {
    /**
     * Извлекает текст PDF с сохранением номеров страниц.
     *
     * @throws {@link BadRequestException}
     * Если файл невозможно прочитать или в нём нет текстового слоя.
     *
     * @remarks
     * OCR не выполняется. Пустые страницы пропускаются,
     * исходная нумерация остальных страниц сохраняется.
     */
    async extract(buffer: Buffer): Promise<ExtractedDocument> {
        let document: ExtractedDocument;

        try {
            const parser = new PDFParse({
                data: new Uint8Array(buffer),
            });

            try {
                const result = await parser.getText();

                document = {
                    parts: result.pages
                        .map((page) => ({
                            text: page.text.replace(/\r\n?/g, '\n').trim(),
                            pageNumber: page.num,
                        }))
                        .filter((part) => part.text.length > 0),
                };
            } finally {
                await parser.destroy();
            }
        } catch {
            throw new BadRequestException(
                'Не удалось прочитать PDF. Файл может быть повреждён или защищён паролем.',
            );
        }

        if (document.parts.length === 0) {
            throw new BadRequestException(
                'PDF не содержит доступного текста. Для сканированного документа требуется OCR.',
            );
        }

        return document;
    }
}
