import {
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import {
    DOCUMENTS_REPOSITORY,
    type DocumentsRepositoryInterface,
} from './interfaces/documents-repository.interface';
import type { Document } from './document.entity';
import type { EmployeeRole } from '../employees/employee.entity';

@Injectable()
export class DocumentsService {
    constructor(
        @Inject(DOCUMENTS_REPOSITORY)
        private readonly repository: DocumentsRepositoryInterface,
    ) {}

    /**
     * Возвращает доступные роли опубликованные документы
     * среди записей, полученных от репозитория.
     *
     * @param role - Роль из проверенного контекста пользователя.
     * @returns Доступные документы или пустой массив.
     *
     * @remarks
     * Репозиторий ограничивает выборку до фильтрации по доступу.
     * Поэтому результат не является полным каталогом документов.
     */
    async findAvailableForRole(
        role: EmployeeRole,
    ): Promise<Document[]> {
        const documents = await this.repository.findAll();

        return documents.filter((document) =>
            document.canBeReadBy(role),
        );
    }

    /**
     * Получает опубликованный документ, доступный указанной роли.
     *
     * @param id - Идентификатор документа.
     * @param role - Роль из проверенного контекста пользователя.
     * @returns Доступный документ.
     * @throws {@link NotFoundException} Если документ отсутствует
     * или недоступен пользователю.
     *
     * @remarks
     * Одинаковая ошибка не раскрывает существование
     * недоступного документа.
     */
    async getAvailableById(
        id: string,
        role: EmployeeRole,
    ): Promise<Document> {
        const document = await this.repository.findById(id);

        if (!document || !document.canBeReadBy(role)) {
            throw new NotFoundException('Документ не найден.');
        }

        return document;
    }
}
