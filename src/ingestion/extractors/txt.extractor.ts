import { BadRequestException, Injectable } from '@nestjs/common';
import { TextDecoder } from 'node:util';
import type {
    ExtractedDocument,
} from '../types/extracted-document';

@Injectable()
export class TxtExtractor {
    /**
     * Извлекает текст из TXT-файла в кодировке UTF-8.
     *
     * @throws {@link BadRequestException}
     * Если кодировка некорректна или файл не содержит текста.
     */
    extract(buffer: Buffer): ExtractedDocument {
        let text: string;

        try {
            text = new TextDecoder('utf-8', {
                fatal: true,
            }).decode(buffer);
        } catch {
            throw new BadRequestException(
                'TXT-файл должен быть в кодировке UTF-8.',
            );
        }

        text = text.replace(/\r\n?/g, '\n').trim();

        if (!text) {
            throw new BadRequestException(
                'TXT-файл не содержит текста.',
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
