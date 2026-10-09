# Integration test infrastructure

Run `npm run test:integration` with Node.js 24.9+ on the host and a running local Docker engine
accessible through a Unix socket (macOS or Linux). Remote Docker endpoints are refused.
The production Dockerfile uses Node.js 22 and is not intended to run this integration suite.
The runner currently executes `docker pull postgres:17` on every run, including when
the image is already cached, so every run requires access to the Docker registry.
Jest, NestJS testing
utilities, and Supertest are development dependencies. The runner builds application
code before testing so CommonJS tests use the current compiled decorator metadata.
The suite covers database infrastructure, `GET /`, `POST /auth/login`, `GET /employees`,
the three existing HR employee read endpoints, and `POST /chat`.
The Jest child uses `--experimental-vm-modules` because NestJS Config 12 is ESM
and the compiled application requires it from CommonJS. Jest 30.5 supports this
synchronous ESM loading on Node.js 24.9+. No dependency transforms are used.
Only the chat suite mocks external Gemini and Qdrant SDKs.

The runner creates a uniquely named container and database for every run, publishes
PostgreSQL on a dynamically assigned IPv4 loopback port, and stores database data
in a temporary filesystem. It never uses the development Compose service, existing
database credentials, `.env`, or `.env.test`. Do not supply a database URL or port.
The existing `npm test` command remains unchanged and does not require Docker.

The runner generates temporary credentials in memory and creates two independent
non-administrative login roles. `integration_migrator` owns migration-created tables;
`integration_app` can read the five application tables but cannot write, create
tables, or read migration history. An internal administrator connection provisions
the roles and a read-only run marker. No seed files are loaded.

Before migrations and tests, the runner checks the container ID, unique ownership
label, and loopback port binding. Connections require the exact generated database
name, fixed role, run marker, and restricted PostgreSQL role attributes. There is
no fallback to DB_* or PG* environment settings. Migration and Jest children receive
an allowlisted environment without NODE_OPTIONS or application secrets. The runner
invokes `node scripts/migrate.mjs` directly because `npm run db:migrate` loads `.env`.
Migration files and the migration runner are reused without changes.

The infrastructure tests verify all migration filenames/checksums, table ownership,
read-only application privileges, empty tables, and fail-closed identity checks.
Tests use one Jest worker. Passwords are not included in command arguments or
diagnostics; child output is redacted and raw provisioning/migration errors are
suppressed. Docker administrators can inspect container environment variables, so
the local Docker engine must be trusted.

Use `npm run test:integration -- --detectOpenHandles` to check for leaked handles.
Use `npm run test:integration -- --testPathPatterns=missing-infrastructure-test`
to exercise the Jest failure cleanup path; this command is expected to fail.
Both commands still create their own isolated database and run all migrations.
Do not invoke connectivity tests directly with an arbitrary database context.

The runner closes database connections and removes its own labelled container and
associated anonymous volumes on success, failure, SIGINT, or SIGTERM. Cleanup never
uses Docker prune or removes containers by a shared prefix. SIGKILL, host shutdown,
or Docker engine failure can prevent cleanup. A cleanup failure is reported with
the unique container name; inspect its `workguide.integration.run` label before
manually removing that specific container. Images remain cached for later runs.

The authentication suite imports the real AuthModule into a NestJS testing
application, reproduces the production ValidationPipe, and uses Supertest for HTTP
requests. AuthController, AuthService, AuthRepository, PasswordService, JWT signing
and verification, and DatabaseService are real. The application pool is checked
against the database identity marker before application initialization. ConfigModule
uses explicit generated test settings, ignores env files and process environment,
and validates settings with the production environment schema. AI/vector schema
placeholders never come from environment files. Chat imports the AI/vector modules
with their external SDKs replaced before module loading; other suites do not import them.

Reusable employee fixtures have fixed UUIDs, profiles, statuses, and timestamps.
An actual PasswordService creates a salted hash from a private generated password
once per suite. Each test inserts active, inactive, and unprovisioned employees.
Before and after each test, cleanup rechecks the migration role and marker, truncates
only the five explicit application tables without CASCADE, and verifies zero rows.
The identity marker and migration history remain intact. The runner independently
checks for leftover application data after successful Jest completion.

Login tests cover success, token shape/signature/claims, email normalization,
significant password whitespace, invalid DTOs, unknown/inactive employees, incorrect
passwords, and missing password hashes. Each invalid DTO scenario checks its relevant
field or validation constraint in the actual NestJS 12 error response.
Every HTTP response is checked for sensitive
fields and credential values using assertions that do not print those values in
failure diffs. The suite closes the NestJS application (including its PostgreSQL
pool) and its fixture connection even after test failures.

The `GET /` smoke test uses the real AppController and Supertest through the shared
testing application helper. It checks HTTP 200 and the complete public JSON response
without authentication. It creates no fixtures and performs no database mutations;
the helper still verifies the disposable database pool and closes it with the app.

The employees suite reuses the application and employee fixtures, adding HR/admin
profiles only for that suite. Tokens normally come from real HTTP login. Only the
expired-token case uses the real JwtService directly to sign an already expired
token without waiting or replacing the clock. AuthGuard and RolesGuard remain real.
Tests cover HR/admin access, employee denial, missing/malformed/tampered/expired
tokens, exact public fields and types, all three ordering keys, and the first 100
results from 102 database rows. Reads are checked against database row fingerprints
to detect changes without printing password hashes. Fixture setup and teardown
restore the baseline for every test, including after larger/custom datasets.

An empty employees table cannot return HTTP 200 with an authenticated request:
AuthGuard looks up the token subject in that same table and returns 401 if it is
absent. The test obtains a real token, empties the isolated database, checks HTTP
401, and separately confirms the real EmployeesService/repository return an empty
list. No guard is bypassed and production behavior is unchanged.
Guard-generated 401 responses contain only message and statusCode in NestJS 12;
unlike login's custom credential errors, they do not contain an error property.

The HR suite imports the real HrModule and reuses employee fixtures, login,
application configuration, and guarded cleanup. Deterministic HR fixtures include
requests with all three statuses and creation-date/UUID ties, leave balances with
whole and half days and boundary years, and onboarding tasks with all four statuses,
same-date ties, completed_at, and null due dates. Foreign employee rows deliberately
sort before owned rows to verify that owner filtering precedes the 100-record limit.
Fixtures are inserted out of response order to exercise the actual SQL ordering.

HR request responses contain only id, subject, and status; requests sort by created_at
descending then id ascending. Task responses contain id, employeeId, title, status,
and dueDate; tasks sort by due_date ascending with nulls last, then id ascending.
Dates are YYYY-MM-DD or null. Database pending maps through domain todo back to API
pending. Balance responses contain employeeId, year, entitledDays, usedDays, and the
calculated remainingDays as JSON numbers. No record ID, description, created_at,
completed_at, SQL column names, or credential fields are exposed unless explicitly
part of that endpoint's response contract.

Tokens for employee, HR, and admin accounts are obtained through real HTTP login
once per suite and reused against freshly restored employees. Expired tokens use
the actual JwtService. Every HR HTTP request compares fingerprints of all five
application tables before and after execution, including security and validation
failures. Own-data restrictions apply to HR and admin as well as employees; foreign
data returns 403 with only message/statusCode. Missing balances return 404 with
the existing custom message and an error field. UUIDs must be version 4; uppercase
own UUIDs are accepted. Years must be raw decimal integers between 2000 and 2100;
leading zeros are accepted, while whitespace, decimals, hex, exponent notation,
and out-of-range years return 400. A query-string employeeId cannot override the
identity established by authentication and route ownership.

The chat suite imports the real ChatModule, including ChatService, question routing,
the HR executor, document retrieval/RAG, services, repositories, guards, and JWT.
Only ChatGoogle, GoogleGenerativeAIEmbeddings, and QdrantClient are replaced at the
SDK boundary. Their constructors cannot create live clients. Unexpected SDK calls
fail instead of falling back to a network service. Routing replies contain only
decisions, never HR results. The real router parses and validates those replies.

Chat SQL tests cover leave balances, requests, onboarding tasks, operation order,
employee/HR/admin isolation, missing balances, empty owned lists, fractional days,
and exact public DTOs. A test replaces all three HR datasets while keeping the
same model decision and verifies changed HTTP answers, preventing static routing
stubs from masquerading as database integration. Every chat request fingerprints
all five tables before and after execution, including failed requests. Existing
guarded fixture setup and cleanup run between tests and close both NestJS and the
fixture connection at suite completion.

Chat returns HTTP 201 for valid SQL, DOCUMENTS, HYBRID, and CLARIFICATION results.
Missing balances use an operation-level NOT_FOUND status rather than HTTP 404.
Questions are trimmed before routing and responding; the length boundary is 4000
UTF-16 code units after trimming. Invalid DTOs return 400 before model invocation;
missing/invalid/expired tokens return 401. Malformed, unsupported, duplicate, or
identity-bearing model operations and external routing failures return 503.

Document tests insert a published, indexed PostgreSQL fixture and return a fixed
SDK vector result and cited model answer. Real retrieval verifies role access and
generation identifiers, builds the Qdrant filter, and takes the source title from
PostgreSQL rather than trusting vector metadata. Source generationId is part of
the current public contract. An inaccessible document or empty document table
returns SUCCESS with insufficientInformation and no sources. External generation
failure becomes document UNAVAILABLE while HYBRID preserves real HR results.
An unexpected Qdrant SDK exception currently propagates as HTTP 500, not UNAVAILABLE;
the test records that behavior without changing production error handling.

Live SDK/network compatibility, all RAG citation/access-race combinations, and
HR-operation UNAVAILABLE during a database outage remain outside this stage.
Future mutations must verify database identity before executing and use the migration
role, never widen the application role's privileges. Do not run concurrent tests
against the same disposable database because fixture cleanup is shared.
