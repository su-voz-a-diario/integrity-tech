# Integrity Test Environment & Secrets

## Environments

Development:
- Local developer machines.
- `ENABLE_DEV_AUTH=true` is allowed.
- Swagger may be enabled.
- Demo credentials may exist.

Staging:
- Production-like validation without real customer data.
- `ENABLE_DEV_AUTH=false`.
- Redis rate limiting required.
- Swagger may be enabled only behind private access.

Production:
- No demo auth.
- No Swagger.
- Redis rate limiting required.
- Explicit CORS origins.
- Strong secrets from a secret manager or deployment platform.

## Required Backend Variables

Common:
- `PORT`
- `NODE_ENV`
- `DATABASE_URL`
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_URL`
- `RATE_LIMIT_STORE`
- `JWT_SECRET`
- `ACCESS_TOKEN_TTL_SECONDS`
- `REFRESH_TOKEN_TTL_DAYS`
- `CORS_ORIGINS`
- `SHOW_SWAGGER`
- `ENABLE_DEV_AUTH`
- `API_BODY_LIMIT`

Production hard requirements:
- `DATABASE_URL` must be set.
- `REDIS_URL` must be set.
- `JWT_SECRET` must be at least 32 characters and not a placeholder.
- `ENABLE_DEV_AUTH=false`.
- `RATE_LIMIT_STORE=redis`.
- `SHOW_SWAGGER=false`.
- `CORS_ORIGINS` must be explicit and must not be `*`.

Observability:
- `OTEL_ENABLED`
- `OTEL_SERVICE_NAME`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `LOG_LEVEL`
- `BUILD_DATE`

Smoke validation:
- `SMOKE_API_BASE_URL` enables the optional HTTP smoke flow, for example `http://localhost:3001/api`.
- `SMOKE_STAFF_EMAIL` defaults to `recruiter-a@e2e.integrity.test`.
- `SMOKE_ADMIN_EMAIL` defaults to `admin-a@e2e.integrity.test`.
- `SMOKE_STAFF_PASSWORD` defaults to `E2E_STAFF_PASSWORD` when present.
- `SMOKE_ORGANIZATION_SLUG` defaults to `e2e-org-a`.
- `SMOKE_EXAM_ID` defaults to the E2E published exam id.

Storage:
- `STORAGE_PROVIDER` (`local-private` in development, `s3` in staging/production).
- `STORAGE_LOCAL_PRIVATE_PATH` for development-only private files.
- `STORAGE_S3_BUCKET`.
- `STORAGE_S3_REGION`.
- `STORAGE_S3_ENDPOINT` for S3-compatible providers when needed.
- `STORAGE_S3_ACCESS_KEY_ID`.
- `STORAGE_S3_SECRET_ACCESS_KEY`.
- `STORAGE_SIGNED_URL_TTL_SECONDS`.
- `STORAGE_MAX_FILE_BYTES`.

Production storage requirements:
- `STORAGE_PROVIDER=s3`.
- `STORAGE_SIGNED_URL_TTL_SECONDS` must be short, ideally `300` and never above `900`.
- Object storage credentials must come from a secret manager.
- Buckets must be private; public object URLs are not supported.

## Required Frontend Variables

- `BACKEND_URL`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_APP_ENV`
- `NEXT_PUBLIC_APP_VERSION`
- `NEXT_PUBLIC_BACKEND_VERSION`
- `NEXT_PUBLIC_BUILD_DATE`

## Secret Manager Candidates

Store these outside the repo:
- `DATABASE_URL`
- database username/password
- `REDIS_URL`
- `REDIS_PASSWORD`
- `JWT_SECRET`
- any future session/refresh signing secret
- OTLP credentials if required by the telemetry backend
- storage provider credentials

Never commit:
- `.env`
- `.env.production`
- `.env.staging`
- database dumps with real candidates
- Redis dumps
- private keys
- candidate snapshots
- private file object keys or signed URLs
- psychometric scoring keys

## Rotation Guidance

`JWT_SECRET`:
- Rotate with a planned session invalidation window unless key versioning is implemented.
- After rotation, existing access tokens become invalid.
- Revoke active `UserSession` records if compromise is suspected.

Refresh/session secrets:
- Current refresh tokens are stored as hashes in the database.
- If a hashing or signing secret is added later, rotate by revoking active sessions and forcing login.

Redis credentials:
- Rotate by updating the secret manager, restarting backend/workers, then rotating Redis itself.

Database credentials:
- Create a new DB user, deploy new `DATABASE_URL`, verify readiness, then revoke the old user.
