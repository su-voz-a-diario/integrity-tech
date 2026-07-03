# Integrity Test Runbooks

## Health Checks

Liveness:

```bash
curl -i http://localhost:3001/health/live
```

Readiness:

```bash
curl -i http://localhost:3001/health/ready
```

Dependencies:

```bash
curl -i http://localhost:3001/health/dependencies
```

## Metrics

```bash
curl http://localhost:3001/metrics
```

Important metrics:
- `integrity_http_requests_total`
- `integrity_http_request_duration_seconds`
- `integrity_dependency_health`
- `integrity_queue_jobs_total`
- `integrity_db_queries_total`
- `integrity_audit_events_total`

## DB Unavailable

Symptoms:
- `/health/ready` returns `not_ready`.
- `integrity_dependency_health{dependency="postgresql"} 0`.
- Operational event `DB_UNAVAILABLE`.

Actions:
1. Check database host/network.
2. Check credentials in secret manager.
3. Check connection limits.
4. Do not restart all app instances simultaneously.
5. If migration caused the issue, stop rollout and follow migration failure mitigation.

## Redis Unavailable

Symptoms:
- `/health/ready` returns `not_ready`.
- `integrity_dependency_health{dependency="redis"} 0`.
- Operational events `REDIS_UNAVAILABLE` or `QUEUE_STALLED`.

Actions:
1. Verify Redis endpoint and credentials.
2. Confirm Redis memory and eviction status.
3. Restart workers after Redis recovers if queues remain stalled.
4. Keep rate limiting in fail-safe mode for production.

## Audit Unavailable

Symptoms:
- `integrity_audit_events_total{status="failure"}` increases.
- Operational event `AUDIT_UNAVAILABLE`.

Actions:
1. Check database availability.
2. Check migration state of `audit_events`.
3. Treat as compliance-impacting incident if persistent.

## Storage Unavailable

Symptoms:
- `/health/dependencies` reports storage as `down`.
- `integrity_dependency_health{dependency="storage"} 0`.
- Operational event `STORAGE_UNAVAILABLE`.
- Snapshot/proctoring upload fails without creating public files.

Actions:
1. Check `STORAGE_PROVIDER` and provider credentials.
2. For local development, verify `STORAGE_LOCAL_PRIVATE_PATH` exists and is writable by the backend process.
3. For S3-compatible storage, verify bucket, region, endpoint and IAM permissions.
4. Confirm the bucket blocks public access.
5. Retry the affected candidate flow only after readiness is healthy.

## Manual Rollback

Container rollback:
1. Keep previous image tag available.
2. Stop rollout.
3. Redeploy previous backend/frontend image.
4. Verify `/health/ready`.
5. Verify login, invitation claim and exam session.

Database rollback:
- Prefer forward corrective migration.
- Restore backup only if data integrity or startup is broken and corrective migration is unsafe.
- Never use `prisma migrate reset` outside local development.

## Database Baseline And Reproducibility

The authoritative database bootstrap is:

```bash
cd integrity-tech-backend
npx prisma migrate deploy
npx prisma generate
npm run seed
npm run smoke
```

For E2E/staging validation use the isolated E2E seed:

```bash
cd integrity-tech-backend
npx prisma migrate deploy
npm run seed:e2e
npm run smoke
```

`db/schema.sql` is not part of the deployment path. If a clean environment requires manual SQL before Prisma migrations, treat it as a release blocker.

For databases that already existed before `20260701000000_baseline_initial_schema`, do not apply the baseline over existing tables. After schema verification, mark it as applied:

```bash
cd integrity-tech-backend
DATABASE_URL=postgresql://... npx prisma migrate resolve --applied 20260701000000_baseline_initial_schema
DATABASE_URL=postgresql://... npx prisma migrate deploy
```

## Backup And Restore Smoke Test

The backup/restore smoke test requires PostgreSQL client tools: `pg_dump`, `pg_restore`, `psql`, `createdb` and `dropdb`.

```bash
cd integrity-tech-backend
DATABASE_URL=postgresql://postgres:localpassword123@localhost:5432/integrity_tech_db?schema=public npm run smoke:backup-restore
```

The script creates a temporary database on the same PostgreSQL server, restores a custom-format dump, validates core tables and `pgcrypto`, then drops the temporary database.

## Deployment Verification

```bash
curl http://localhost:3001/health/live
curl http://localhost:3001/health/ready
curl http://localhost:3001/health/dependencies
curl http://localhost:3001/metrics
```

Smoke test:
1. Run `npm run smoke` for DB, seed and governance checks.
2. Set `SMOKE_API_BASE_URL=http://localhost:3001/api` to include the HTTP flow.
3. Staff login.
4. Create invitation.
5. Verify invitation.
6. Claim invitation.
7. Accept candidate consent.
8. Load exam session.
9. Submit answers.
10. Finalize attempt.
11. Open report.
12. Confirm audit events.
