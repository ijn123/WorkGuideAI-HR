# WorkGuide AI

Внутренний HR-помощник для сотрудников. Структурный каркас для команды из трёх человек.

## Статус

Реализовано:
- Запуск NestJS и GET / для проверки статуса приложения.
- POST /chat с проверкой запроса через Zod и подключением Gemini API.
- Подключение PostgreSQL через ConfigModule и переменные окружения.
- Проверка настроек подключения через Zod.
- Доменные сущности сотрудников, HR-заявок, отпусков,
  задач адаптации и документов.
- Таблицы, первичные и внешние ключи, ограничения и индексы.
- Репозитории и мапперы строк БД в доменные сущности.
- GET /employees — список сотрудников.
- GET /hr/employees/:employeeId/requests — HR-заявки.
- GET /hr/employees/:employeeId/leave-balance/:year — баланс отпуска.
- GET /hr/employees/:employeeId/onboarding-tasks — задачи адаптации.
- Проверка параметров маршрутов и DTO ответов.
- Подключение приложения под пользователем с правами чтения.
- Запуск миграций с историей выполнения и контрольными суммами.
- Тестовые данные для четырёх HR-таблиц.
- JWT authentication with login, protected endpoints, and current-employee
  ownership checks on HR routes.

Пока не реализовано:
- Role-based authorization (RBAC); it is not implemented as part of issue #9.
- HTTP-маршруты документов, загрузка и обработка файлов.
- Векторный поиск через Qdrant.
- Маршрутизация вопросов DOCUMENTS / SQL / HYBRID.

HR routes keep `employeeId` in the URL and require it to match the authenticated
employee's UUID. Protected endpoints require a valid JWT.
Для демонстрации используются вымышленные данные.

Запуск приложения: npm run start:dev.

## Открытие в WebStorm

1. Распаковать ZIP в отдельную папку.
2. В WebStorm выбрать открытие проекта и папку workguide-ai, содержащую package.json.
3. Начать с настройки NestJS, зависимостей и main.ts / app.module.ts.
4. После подключения конфигурации скопировать .env.example в .env и заполнить значения локально. Ключ API не публиковать.

## Согласованный стек

TypeScript, NestJS, LangChain.js, Gemini API, Qdrant, Zod.
LangGraph, Ollama и Qwen не используются. Модели Gemini для ответов и эмбеддингов выбираются отдельно; их идентификаторы пока не заданы.

## Назначение модулей

- auth: login, JWT verification, and current authenticated user extraction; RBAC is not implemented.
- employees: профиль сотрудника и связь с авторизацией.
- database: подключение PostgreSQL, миграции и тестовые данные.
- hr: остатки отпусков, обращения и задачи адаптации.
- documents: загрузка, список, удаление, статус обработки и метаданные.
- ingestion: извлечение текста, очистка, чанки с документом и страницей.
- ai: подключение Gemini и отдельная векторизация через LangChain.js.
- vector-storage: операции Qdrant.
- retrieval: поиск подходящих фрагментов.
- chat: маршрутизация DOCUMENTS / SQL / HYBRID и итоговый ответ.
- prompts: инструкции модели.
- config: настройки и их проверка Zod.
- health: проверка доступности приложения.
- common: общие ошибки и логирование без персональных данных и ключей.

## Правила реализации

Use `employeeId` from verified authentication. HR controllers check ownership
and pass the authenticated employee ID to HR services.

Gemini выбирает разрешённую операцию, а репозиторий выполняет заранее написанный параметризованный SQL. Внешний ответ модели проверяется Zod. Отсутствие источников означает отсутствие подтверждённого ответа. Не имитировать результаты базы. Документы для демонстрации и сотрудники вымышленные.

## Два процесса

Загрузка: documents → ingestion → ai/embeddings → vector-storage.
Вопрос: chat → routing → retrieval и/или hr → ai/gemini → ответ с источниками.

## Разделение задач

1. Участник 1: documents, ingestion, vector-storage, retrieval.
2. Участник 2: auth, employees, database, hr.
3. Участник 3: ai, chat, prompts, config.
Совместно: тесты доступа, интеграция, Docker, деплой, документация.

В Git работать через отдельные ветки и Pull Request с проверкой другим участником. Задачи вести в GitHub Project. Первый деплой на DigitalOcean выполнить после появления минимального рабочего HTTP-функционала; затем настроить автоматическое обновление.

## Учебные документы

data/hr-documents пока пустая. План: внутренний распорядок; отпуск; болезнь и отсутствие; удалённая работа; адаптация; обучение; командировки; контакты HR и обращения. Ресторанные материалы в проект не включены.


## Локальный запуск с PostgreSQL


### 1. Установить зависимости

```bash
npm install
```

### 2. Подготовить настройки

Скопировать `.env.example` в `.env`.
В PowerShell:

```powershell
Copy-Item .env.example .env
```

Если `.env` уже существует, не перезаписывать его —
добавить недостающие настройки вручную.

В `.env` указать собственный `POSTGRES_PASSWORD`.

### 3. Запустить PostgreSQL

Открыть Docker Desktop, затем выполнить:

```bash
docker compose up -d postgres
```

Проверить готовность базы:

```bash
docker compose exec postgres pg_isready -U workguide -d workguide_ai
```

Ожидаемый результат: `accepting connections`.

### Пользователь приложения с правами чтения

После выполнения миграций откройте PostgreSQL под администратором:

```powershell
docker compose exec postgres psql -U workguide -d workguide_ai
```

Если роль workguide_reader ещё не существует, создайте её:

```sql
CREATE ROLE workguide_reader
    LOGIN
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    NOREPLICATION
    NOBYPASSRLS;
```

Роли общие для всего экземпляра PostgreSQL:
для второй базы в том же контейнере повторно создавать роль не нужно.

Выдайте права для текущей базы:

```sql
GRANT CONNECT ON DATABASE workguide_ai TO workguide_reader;
GRANT USAGE ON SCHEMA public TO workguide_reader;

GRANT SELECT ON TABLE
    public.employees,
    public.hr_requests,
    public.leave_balances,
    public.onboarding_tasks,
    public.documents
TO workguide_reader;
```

При первоначальной настройке задайте пароль интерактивно:

```text
\password workguide_reader
```

Для выхода:

```text
\q
```

Укажите в рабочем .env:

```dotenv
DB_USER=workguide_reader
DB_PASSWORD=установленный_пароль
```

Пароль существующей роли без необходимости не меняйте:
это повлияет на все подключения, использующие эту роль.

Миграции выполняются под отдельным пользователем,
указанным в DB_MIGRATION_USER.

При добавлении новых таблиц права чтения выдаются явно.
Доступ к schema_migrations приложению не требуется.

### 4. Запустить приложение

```bash
npm run start:dev
```

При успешном подключении в терминале появится:
`Подключение к PostgreSQL установлено.`

Приложение: http://localhost:3000

### Параметры базы

- Адрес для NestJS: `127.0.0.1`
- Порт на компьютере: `5433`
- База: `workguide_ai`
- Пользователь: `workguide_reader`
- Администратор локальной базы и пользователь миграций: `workguide`

Каждый участник запускает отдельную локальную базу.
Данные сохраняются в Docker-томе `postgres_data`.

### Остановка базы

```bash
docker compose stop postgres
```

Пароль задаётся при первой инициализации базы.
Изменение `POSTGRES_PASSWORD` в `.env` не меняет пароль
в уже созданной базе.

## Схема базы, миграции и тестовые данные

Таблицы:
- employees — сотрудники.
- hr_requests — обращения в HR.
- leave_balances — годовые балансы отпуска.
- onboarding_tasks — задачи адаптации.
- documents — метаданные документов и разрешённые роли.
- schema_migrations — история выполненных миграций.

### Подключение

Приложение использует DB_USER и DB_PASSWORD.
Для него предназначен пользователь workguide_reader.

Скрипт миграций использует отдельные настройки:
DB_MIGRATION_USER и DB_MIGRATION_PASSWORD.

Адрес, порт и имя базы задаются через DB_HOST, DB_PORT и DB_NAME.
Рабочий .env с паролями не добавляется в Git.

### Миграции для новой базы

После запуска PostgreSQL и заполнения .env:

```powershell
npm run db:migrate
```

Скрипт выполняет SQL-файлы из src/database/migrations
по порядку и сохраняет их контрольные суммы в schema_migrations.

Повторный запуск пропускает выполненные миграции.
Уже зарегистрированные файлы нельзя изменять или переименовывать.
Изменения схемы добавляются новым файлом с очередным номером.

При ошибке текущая миграция откатывается, выполнение останавливается.
Ранее успешно выполненные миграции остаются применёнными.

### Ранее настроенная база без истории миграций

Не запускайте регистрацию истории на пустой или непроверенной базе.

Скрипт baseline-migrations.mjs предназначен только для базы,
схема которой проверена на соответствие миграциям 001–009:

```powershell
node --env-file=.env scripts/baseline-migrations.mjs --confirm-reviewed-schema
npm run db:migrate
```

Скрипт регистрации не выполняет SQL миграций.
Он записывает в историю девять ранее выполненных файлов.

### Тестовые данные

Для новой базы сначала выполните все миграции,
затем загрузите SQL-файлы из src/database/seeds:

```powershell
$seedFiles = Get-ChildItem "src/database/seeds/*.sql" |
    Sort-Object Name

foreach ($file in $seedFiles) {
    Get-Content -Raw $file.FullName |
        docker compose exec -T postgres psql -U workguide -d workguide_ai -v ON_ERROR_STOP=1

    if ($LASTEXITCODE -ne 0) {
        throw "Ошибка загрузки: $($file.Name)"
    }
}
```

Команда рассчитана на локальные базу workguide_ai
и администратора workguide.

Сотрудники и HR-данные вымышленные.
Файлы 001–004 пропускают существующие записи по ключам конфликта.
Файл 005 заполняет отсутствующую дату завершения одной тестовой задачи.

В каждой из четырёх HR-таблиц создаются три записи.
Таблица documents пока остаётся пустой.

Для старой базы с завершённой тестовой задачей без completed_at:
после миграции 007 выполните seed 005, затем миграцию 008.
Для остальных существующих завершённых задач нужны достоверные
даты завершения — автоматически подставлять сроки задач нельзя.

## Authentication

Set both required environment variables before starting the application:

- `JWT_SECRET`: a randomly generated secret with at least 32 characters.
- `JWT_EXPIRES_IN_SECONDS`: a positive integer token lifetime in seconds.

Neither value has an application default. Keep real secrets out of source code
and documentation. The `3600` value in `.env.example` is an example configuration.

After explicitly provisioning an existing employee as described below, call
`POST /auth/login` with fictional example values replaced by your local credentials:

```json
{
  "workEmail": "employee@example.com",
  "password": "example-password"
}
```

`workEmail` is trimmed and lowercased; the password is not trimmed or normalized.
Only active employees with provisioned credentials can log in. Successful login
returns HTTP 200 with this response shape:

```json
{
  "accessToken": "<jwt>",
  "tokenType": "Bearer",
  "expiresIn": 3600
}
```

`expiresIn` reflects `JWT_EXPIRES_IN_SECONDS`; `3600` above is an example, not a
hard-coded application TTL. Invalid request DTOs return 400. Authentication
failures return a generic 401 without revealing whether email, password,
credential provisioning, or employee status caused the failure.

Send the returned token on protected requests:

```http
Authorization: Bearer <token>
```

Missing, invalid, or expired authentication returns 401. The employee must still
exist and be active when making a protected request.

| Access | Endpoint |
| --- | --- |
| Public | `GET /` |
| Public | `POST /auth/login` |
| Protected | `GET /employees` |
| Protected | `POST /chat` |
| Protected | `GET /hr/employees/:employeeId/leave-balance/:year` |
| Protected | `GET /hr/employees/:employeeId/requests` |
| Protected | `GET /hr/employees/:employeeId/onboarding-tasks` |

For authenticated HR requests, `:employeeId` must be the authenticated employee's
UUID. A different valid UUID returns 403 before the HR service is called.
Malformed UUIDs retain the existing 400 request-validation behavior (UUID v4).
There is no admin/HR role bypass. Role-based authorization is not implemented
as part of issue #9.

## Explicit local/demo password provisioning

Provisioning is an explicit developer/admin action. Apply migration 010 and
create or seed the employee before provisioning.
This command updates only the password hash of an existing employee; it never
creates employees or runs automatically during startup, migrations, or seeds.

Set these variables in your local shell environment before running the command:

- `AUTH_PROVISION_EMAIL`: the existing employee's work email (trimmed and lowercased).
- `AUTH_PROVISION_PASSWORD`: the password, supplied through the environment only.
  Do not pass it as a command-line argument or commit it to source or seed files.
  The password is preserved exactly, including whitespace, case, and Unicode.
- `AUTH_PROVISION_OVERWRITE`: optional, exactly `true` or `false`; defaults to `false`.
  An existing non-NULL hash is refused unless overwrite is explicitly `true`.

```bash
npm run auth:provision
```

The command loads existing database settings from `.env` when present and uses
`DB_MIGRATION_USER` / `DB_MIGRATION_PASSWORD`, with the same host, port, database,
and SSL settings as the migration runner. It requires `ts-node` from the development
dependencies. Keep the runtime `DB_USER` read-only; no additional grants are needed.

Provisioning uses the shared `PasswordService` and stores only its encoded hash.
Passwords must be non-empty and at most 1024 UTF-8 bytes; the Login DTO enforces
the same size limit. Clear `AUTH_PROVISION_PASSWORD` from the shell environment
after use. No plaintext or default passwords are stored in source or seed files;
the login example above is a fictional placeholder, not a provisioned credential.
