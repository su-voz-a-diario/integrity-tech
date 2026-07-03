CREATE TABLE "private_files" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "owner_user_id" UUID,
  "attempt_id" UUID,
  "resource_type" VARCHAR(80) NOT NULL,
  "resource_id" VARCHAR(120),
  "storage_provider" VARCHAR(50) NOT NULL,
  "bucket" VARCHAR(255),
  "object_key" TEXT NOT NULL,
  "mime_type" VARCHAR(120) NOT NULL,
  "size_bytes" BIGINT NOT NULL,
  "checksum_sha256" VARCHAR(64) NOT NULL,
  "classification" VARCHAR(50) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  CONSTRAINT "private_files_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "private_files_storage_provider_check" CHECK ("storage_provider" IN ('local-private', 's3')),
  CONSTRAINT "private_files_classification_check" CHECK ("classification" IN ('CONFIDENTIAL', 'HIGHLY_SENSITIVE')),
  CONSTRAINT "private_files_size_bytes_check" CHECK ("size_bytes" > 0),
  CONSTRAINT "private_files_checksum_sha256_check" CHECK ("checksum_sha256" ~ '^[a-f0-9]{64}$')
);

ALTER TABLE "private_files"
  ADD CONSTRAINT "private_files_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "private_files"
  ADD CONSTRAINT "private_files_owner_user_id_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "private_files"
  ADD CONSTRAINT "private_files_attempt_id_fkey"
  FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "private_files_organization_id_resource_type_resource_id_idx"
  ON "private_files"("organization_id", "resource_type", "resource_id");

CREATE INDEX "private_files_organization_id_attempt_id_idx"
  ON "private_files"("organization_id", "attempt_id");

CREATE INDEX "private_files_organization_id_owner_user_id_idx"
  ON "private_files"("organization_id", "owner_user_id");

CREATE INDEX "private_files_checksum_sha256_idx"
  ON "private_files"("checksum_sha256");
