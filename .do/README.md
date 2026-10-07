# Database migrations before DigitalOcean deployment

`pre-deploy-job.yaml` contains only the `jobs` section for the existing
`work-guide-hr-app`, based on its exported App Spec.
This is not a complete App Spec: do not upload it as a replacement for the
entire configuration. Add the section to the current App Spec, preserving
`services`, `databases`, app-level `envs`, ingress, and other settings.
If `jobs` already exists, append `db-migrate` to its list instead of
creating a second `jobs` key.

Saving the App Spec or adding a component in DO triggers a deployment.
Do this only after deployment has been approved and credentials and SSL
have been configured. Keeping this file in the repository does not change
the running application.

## Environment

The job builds from `ijn123/WorkGuideAI-HR`, branch `master`, using the
existing `Dockerfile`. Its working directory is `/app`, and its command
is `npm run db:migrate`.
Migrations run after the build and before the new service version is deployed.

Keep these app-level environment variables:

| Variable | Scope | Value |
| --- | --- | --- |
| DB_HOST | RUN_TIME | The same database cluster hostname used by the application |
| DB_PORT | RUN_TIME | Database cluster port |
| DB_NAME | RUN_TIME | Existing `${db-wghr.DATABASE}` binding; expected to resolve to defaultdb |
| DB_SSL | RUN_TIME | true |

Configure these variables only on the `db-migrate` component:

| Variable | Scope | DO configuration |
| --- | --- | --- |
| DB_MIGRATION_USER | RUN_TIME | A user allowed to create and alter the schema |
| DB_MIGRATION_PASSWORD | RUN_TIME | That user's password; enable Encrypt |
| DB_SSL_CA_CERT | RUN_TIME | `${db-wghr.CA_CERT}` for PostgreSQL Standard Edition |

Empty credentials in the YAML are placeholders, not working values.
Set actual credentials in the DO interface only on the job, not at the
application level or in Git.
The application's `DB_USER` and `DB_PASSWORD` do not replace migration
credentials. The migration user needs permission to create tables and
indexes, alter schema objects, and read and write `public.schema_migrations`.

## SSL

The migration script reads the PEM certificate directly from `DB_SSL_CA_CERT`
and passes it to `pg.Client` as `ssl.ca`. Certificate and hostname verification
remain enabled through `rejectUnauthorized: true`. The CA contents are not logged.
Use the cluster hostname that matches the server certificate.

DO documents `${db-wghr.CA_CERT}` as a runtime CA binding for an attached
Managed Database; `db-wghr` is the database component name in the current
App Spec. The cluster is confirmed to use Standard Edition. Verify the
binding during the first rollout on DO. For Standard Edition, you can also
obtain the CA through Databases → db-wghr → Overview → Connection Details →
Download CA certificate and set its PEM contents in the DO variable.
The certificate file does not need to be committed or included in the Docker image.

Without the CA variable, the migration script uses Node.js's default trust
configuration and still verifies the certificate. Keep the provided CA binding
for this Standard Edition cluster. A real TLS connection has not been tested yet.
The application currently disables certificate verification; the migration
script does not repeat that configuration.

## Repeated runs and failures

The existing migration system retains its history and checksums: applied
migrations are skipped, while changes to or removal of registered migration
files cause an error.
An error returns exit code 1 and blocks deployment of the new version.
The previous service version remains active. The current failed migration
is rolled back; earlier successful migrations remain applied, so schema
changes must stay compatible with the previous application version.
The job does not run baseline registration or seed files.

## Application user privileges

Migrations 001–009 do not execute GRANT statements or configure default
privileges. Tables belong to the migration user. A separate DB_USER does not
automatically receive SELECT access because it connects to the same database.

The current application repositories execute SELECT queries. Before enabling
the job, an administrator must verify the actual DB_USER and DB_MIGRATION_USER
roles, CONNECT on defaultdb, USAGE on public, and SELECT access for DB_USER
on employees, hr_requests, leave_balances, onboarding_tasks, and documents.
The application does not need access to schema_migrations. Local test-role
privileges do not prove that the production application user has the required access.

The project's main README contains manual privilege examples for the local
workguide_reader role only. Production privileges cannot be determined from
repository files. Before the first job run, agree on how DB_USER will access
new tables: default privileges configured for the role creating the objects,
or explicit grants on the created tables during a controlled initial rollout.
Default privileges for another role do not apply to objects created by the
migration role; they affect future objects only and may cover more tables
than the application needs. This job does not grant privileges automatically.

Current migrations use UUID/gen_random_uuid(), without SERIAL, IDENTITY, or
CREATE SEQUENCE. Sequence privileges are therefore not required for these
migrations. If INSERT/UPDATE/DELETE operations or sequences are added later,
check their privileges separately: table privileges do not grant sequence privileges.

## Completed local checks

| Check | Environment | Result |
| --- | --- | --- |
| First npm run db:migrate | Node 24.15.0, PostgreSQL 17.10, separate local database and role | Exit 0; applied 001–009; schema, history, and checksums verified |
| Repeated local run | Same environment | Exit 0; no new migrations; schema and history, including timestamps, unchanged |
| Temporary failing migration 010 | Temporary SQL copy only | Exit 1; table, row, and column rolled back; 010 absent from history; 001–009 retained |
| Existing Dockerfile build | node:22-alpine | Successful; actual Node 22.23.3 and pg 8.23.0; script and all nine SQL files present; .env absent |
| First run from the image | Separate local database, existing test role, PostgreSQL 17.10 | Exit 0; nine migrations applied |
| Repeated run from the image | Same environment | Exit 0; no new migrations; history and column structure unchanged |

Database and user identities were checked before every real local migration
run. The working database and working .env were not used by the migration script.
Test migration 010 was not added to the project. All connections used DB_SSL=false:
real TLS/CA_CERT, PostgreSQL 18, production privileges, and the DO deployment
flow remain unverified. A local process failure does not prove that DO blocks deployment.

## First rollout with automatic deployment from master

These are future steps requiring rollout approval, not a record of a completed deployment.

1. Verify users, privileges, trusted sources, DB_NAME=defaultdb,
   DB_SSL=true, and the CA binding. Agree on application access to new tables.
   Recheck the production schema: the earlier empty-database result may become
   outdated. If HR tables exist without migration history, stop and inspect
   the schema. Do not run baseline registration blindly.
2. Temporarily disable Auto Deploy on the existing web service before merging
   into master. App Spec changes may themselves trigger a deployment: wait for
   any deployment of the old code without the job to finish, then do not
   trigger manual deployments before step 4.
3. After review, merge the code into master. Verify that the expected commit
   is in master; the YAML fragment in Git does not create a job on DO.
4. In the Add components wizard, prepare a Job using the same repository and
   master branch, the repository root, the existing Dockerfile,
   npm run db:migrate, and Before every deploy.
   Before the final Add resources action, set both migration variables only
   on the job, enable Encrypt for the password, and configure the CA binding.
   Do not create a job with empty credentials intending to fill them in later.
   When using App Spec, save the complete current configuration with the job
   and populated credentials in one operation, without writing actual values
   into repository files. Review all settings before saving.
5. The final Add resources/Save action starts the first deployment with the job.
   Check Activity/logs: the job must succeed, apply nine migrations or the
   expected pending count, and finish before the new web-service version becomes live.
   If SSL, CA, credentials, or SQL fail, stop and fix the cause; do not disable
   certificate verification to make deployment succeed.
6. Verify the job's runtime settings: DB_SSL=true, the CA binding, and no
   TLS-verification bypass. A successful job with these settings confirms a
   verified TLS connection. For separate diagnostics, use only a read-only
   connection with the same hostname, CA, and role, and SELECT current_database(),
   current_user; pg_stat_ssl for pg_backend_pid() shows ssl/version/cipher.
   pg_stat_ssl confirms encryption, not the client's CA or hostname verification.
7. In defaultdb, check the nine schema_migrations records and checksums.
   Under DB_USER, check reads from all five HR tables and the agreed privileges.
   Check GET / and GET /employees (an empty list is acceptable: the job does
   not load seeds). SELECT 1 during application startup does not prove access
   to HR tables.
8. After success, restore Auto Deploy on the web service and keep deploy_on_push
   enabled on the job. Changing this setting may trigger another deployment;
   expect zero new migrations. Verify the repeated job and successful web deployment.
9. Verify PRE_DEPLOY failure blocking separately in a test DO application with
   a separate database, not by introducing an artificial failure into production.

Official references:

- [Jobs](https://docs.digitalocean.com/products/app-platform/how-to/manage-jobs/)
- [App Spec](https://docs.digitalocean.com/products/app-platform/reference/app-spec/)
- [Saving App Spec triggers deployment](https://docs.digitalocean.com/products/app-platform/how-to/update-app-spec/)
- [Environment variables and CA_CERT](https://docs.digitalocean.com/products/app-platform/how-to/use-environment-variables/)
- [PostgreSQL SSL](https://docs.digitalocean.com/products/databases/postgresql/how-to/connect/)
- [Deployment blocking on job failure](https://docs.digitalocean.com/products/app-platform/getting-started/migrate-from-heroku/)
- [node-postgres SSL](https://node-postgres.com/features/ssl)
- [PostgreSQL privileges](https://www.postgresql.org/docs/17/ddl-priv.html)
- [Default privileges](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html)
