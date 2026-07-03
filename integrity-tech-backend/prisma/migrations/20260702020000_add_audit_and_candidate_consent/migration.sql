CREATE TABLE "audit_events" (
  "id" UUID NOT NULL DEFAULT generate_uuid_v7(),
  "organization_id" UUID NOT NULL,
  "actor_user_id" UUID,
  "actor_type" VARCHAR(50) NOT NULL,
  "action" VARCHAR(120) NOT NULL,
  "resource_type" VARCHAR(120) NOT NULL,
  "resource_id" VARCHAR(120),
  "ip_address" VARCHAR(45),
  "user_agent" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_events_organization_id_created_at_idx"
  ON "audit_events"("organization_id", "created_at");

CREATE INDEX "audit_events_actor_user_id_created_at_idx"
  ON "audit_events"("actor_user_id", "created_at");

CREATE INDEX "audit_events_resource_type_resource_id_idx"
  ON "audit_events"("resource_type", "resource_id");

ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "candidate_consents" (
  "id" UUID NOT NULL DEFAULT generate_uuid_v7(),
  "organization_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "attempt_id" UUID NOT NULL,
  "consent_version" VARCHAR(50) NOT NULL,
  "accepted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ip_address" VARCHAR(45),
  "user_agent" TEXT,

  CONSTRAINT "candidate_consents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "candidate_consents_attempt_id_key"
  ON "candidate_consents"("attempt_id");

CREATE INDEX "candidate_consents_organization_id_user_id_idx"
  ON "candidate_consents"("organization_id", "user_id");

ALTER TABLE "candidate_consents"
  ADD CONSTRAINT "candidate_consents_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "candidate_consents"
  ADD CONSTRAINT "candidate_consents_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "candidate_consents"
  ADD CONSTRAINT "candidate_consents_attempt_id_fkey"
  FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
