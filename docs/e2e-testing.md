# Integrity Test Enterprise E2E

## Scope

The E2E suite validates the complete Integrity Test platform path across:

- Next.js frontend.
- NestJS backend.
- PostgreSQL.
- Redis rate limiting and queues.
- Local private storage for sensitive files.

It does not add product functionality and does not replace unit or integration tests.

## Local Prerequisites

- Node.js 20.
- PostgreSQL reachable through `DATABASE_URL`.
- Redis reachable through `REDIS_URL`.
- Chromium installed for Playwright.

Example local environment:

```bash
export DATABASE_URL="postgresql://postgres:localpassword123@127.0.0.1:5432/integrity_tech_e2e?schema=public"
export REDIS_HOST=127.0.0.1
export REDIS_PORT=6379
export REDIS_URL="redis://127.0.0.1:6379"
export JWT_SECRET="e2e-jwt-secret-with-at-least-thirty-two-characters"
export CORS_ORIGINS="http://127.0.0.1:3000"
export STORAGE_PROVIDER=local-private
export STORAGE_LOCAL_PRIVATE_PATH=".private-storage/e2e"
export E2E_BACKEND_URL="http://127.0.0.1:3001"
export E2E_FRONTEND_URL="http://127.0.0.1:3000"
export E2E_API_BASE_URL="http://127.0.0.1:3001/api"
```

## First Run

```bash
cd integrity-tech-backend
npm ci
npx prisma migrate deploy
npx prisma generate
npm run seed:e2e

cd ../integrity-tech-frontend
npm ci
npx playwright install chromium
npm run test:e2e
```

`npm run test:e2e` starts backend and frontend through Playwright web servers. PostgreSQL and Redis must already be running.

## CI

GitHub Actions runs E2E as a separate job after backend and frontend checks. The job provisions PostgreSQL, Redis, applies Prisma migrations, seeds isolated E2E data, installs Chromium, and runs:

```bash
npm run test:e2e
```

## E2E Test Users

All use password `IntegrityE2E123!` unless `E2E_STAFF_PASSWORD` overrides it.

- `admin-a@e2e.integrity.test` in `e2e-org-a`
- `recruiter-a@e2e.integrity.test` in `e2e-org-a`
- `psychologist-a@e2e.integrity.test` in `e2e-org-a`
- `evaluator-a@e2e.integrity.test` in `e2e-org-a`
- `recruiter-b@e2e.integrity.test` in `e2e-org-b`

## Covered Scenarios

- Staff login.
- Recruiter dashboard loads against real backend.
- Invitation create, verify and claim.
- Candidate consent.
- Versioned exam session.
- Answer submission through queue path.
- Finalize idempotency.
- Report access with `governanceTrace`.
- Audit events.
- Private snapshot storage metadata and authenticated access.
- RBAC denial for recruiter psychometric console.
- Candidate blocked from staff APIs.
- Tenant isolation with known UUID.
- Revoked session rejection.
- Rate limiting.
- IndexedDB preserves queued answers on network failure and `429`.
- Refresh token flow.
