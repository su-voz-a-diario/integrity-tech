CREATE TABLE "user_sessions" (
  "id" UUID NOT NULL DEFAULT generate_uuid_v7(),
  "user_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "refresh_token_hash" VARCHAR(128) NOT NULL,
  "user_agent" TEXT,
  "ip_address" VARCHAR(45),
  "expires_at" TIMESTAMPTZ NOT NULL,
  "revoked_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_used_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_sessions_user_id_revoked_at_expires_at_idx"
  ON "user_sessions"("user_id", "revoked_at", "expires_at");

CREATE INDEX "user_sessions_refresh_token_hash_idx"
  ON "user_sessions"("refresh_token_hash");

CREATE INDEX "user_sessions_organization_id_idx"
  ON "user_sessions"("organization_id");

ALTER TABLE "user_sessions"
  ADD CONSTRAINT "user_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_sessions"
  ADD CONSTRAINT "user_sessions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
