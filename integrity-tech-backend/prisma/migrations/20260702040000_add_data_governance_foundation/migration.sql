CREATE TABLE "retention_policies" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "data_type" VARCHAR(80) NOT NULL,
  "classification" VARCHAR(50) NOT NULL,
  "active_days" INTEGER NOT NULL,
  "archive_after_days" INTEGER NOT NULL,
  "delete_after_days" INTEGER NOT NULL,
  "purge_after_days" INTEGER NOT NULL,
  "legal_hold_allowed" BOOLEAN NOT NULL DEFAULT true,
  "description" TEXT,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "created_by_user_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "retention_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "data_lifecycle_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "resource_type" VARCHAR(80) NOT NULL,
  "resource_id" VARCHAR(120) NOT NULL,
  "classification" VARCHAR(50) NOT NULL,
  "state" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  "active_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archived_at" TIMESTAMPTZ,
  "deleted_at" TIMESTAMPTZ,
  "purged_at" TIMESTAMPTZ,
  "legal_hold_until" TIMESTAMPTZ,
  "last_reviewed_at" TIMESTAMPTZ,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "data_lifecycle_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "data_export_jobs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "requested_by_user_id" UUID NOT NULL,
  "subject_type" VARCHAR(80) NOT NULL,
  "subject_id" VARCHAR(120) NOT NULL,
  "format" VARCHAR(20) NOT NULL DEFAULT 'JSON',
  "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  "reason" TEXT NOT NULL,
  "manifest" JSONB,
  "exported_payload" JSONB,
  "error_message" TEXT,
  "requested_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ,
  CONSTRAINT "data_export_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "data_deletion_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "requested_by_user_id" UUID NOT NULL,
  "subject_type" VARCHAR(80) NOT NULL,
  "subject_id" VARCHAR(120) NOT NULL,
  "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  "reason" TEXT NOT NULL,
  "dry_run" BOOLEAN NOT NULL DEFAULT true,
  "approved_by_user_id" UUID,
  "approved_at" TIMESTAMPTZ,
  "executed_at" TIMESTAMPTZ,
  "error_message" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "data_deletion_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "data_deletion_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "request_id" UUID NOT NULL,
  "resource_type" VARCHAR(80) NOT NULL,
  "resource_id" VARCHAR(120) NOT NULL,
  "planned_action" VARCHAR(50) NOT NULL,
  "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  "executed_at" TIMESTAMPTZ,
  "checksum_before" VARCHAR(128),
  "metadata" JSONB,
  CONSTRAINT "data_deletion_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "critical_asset_versions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "asset_type" VARCHAR(80) NOT NULL,
  "asset_key" VARCHAR(120) NOT NULL,
  "version" VARCHAR(50) NOT NULL,
  "status" VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  "content_hash" VARCHAR(128) NOT NULL,
  "payload" JSONB NOT NULL,
  "effective_from" TIMESTAMPTZ,
  "effective_to" TIMESTAMPTZ,
  "created_by_user_id" UUID,
  "approved_by_user_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approved_at" TIMESTAMPTZ,
  CONSTRAINT "critical_asset_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "backup_recovery_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID,
  "event_type" VARCHAR(80) NOT NULL,
  "scope" VARCHAR(80) NOT NULL,
  "status" VARCHAR(50) NOT NULL,
  "integrity_hash" VARCHAR(128),
  "storage_ref" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "backup_recovery_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "retention_policies_organization_id_data_type_key" ON "retention_policies"("organization_id", "data_type");
CREATE INDEX "retention_policies_organization_id_classification_idx" ON "retention_policies"("organization_id", "classification");

CREATE UNIQUE INDEX "data_lifecycle_records_organization_id_resource_type_resource_id_key" ON "data_lifecycle_records"("organization_id", "resource_type", "resource_id");
CREATE INDEX "data_lifecycle_records_organization_id_state_resource_type_idx" ON "data_lifecycle_records"("organization_id", "state", "resource_type");
CREATE INDEX "data_lifecycle_records_organization_id_classification_idx" ON "data_lifecycle_records"("organization_id", "classification");

CREATE INDEX "data_export_jobs_organization_id_subject_type_subject_id_idx" ON "data_export_jobs"("organization_id", "subject_type", "subject_id");
CREATE INDEX "data_export_jobs_organization_id_status_requested_at_idx" ON "data_export_jobs"("organization_id", "status", "requested_at");

CREATE INDEX "data_deletion_requests_organization_id_subject_type_subject_id_idx" ON "data_deletion_requests"("organization_id", "subject_type", "subject_id");
CREATE INDEX "data_deletion_requests_organization_id_status_created_at_idx" ON "data_deletion_requests"("organization_id", "status", "created_at");

CREATE INDEX "data_deletion_items_request_id_resource_type_idx" ON "data_deletion_items"("request_id", "resource_type");

CREATE UNIQUE INDEX "critical_asset_versions_organization_id_asset_type_asset_key_version_key" ON "critical_asset_versions"("organization_id", "asset_type", "asset_key", "version");
CREATE INDEX "critical_asset_versions_organization_id_asset_type_asset_key_status_idx" ON "critical_asset_versions"("organization_id", "asset_type", "asset_key", "status");

CREATE INDEX "backup_recovery_events_organization_id_created_at_idx" ON "backup_recovery_events"("organization_id", "created_at");
CREATE INDEX "backup_recovery_events_event_type_status_created_at_idx" ON "backup_recovery_events"("event_type", "status", "created_at");

ALTER TABLE "retention_policies" ADD CONSTRAINT "retention_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "data_lifecycle_records" ADD CONSTRAINT "data_lifecycle_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "data_export_jobs" ADD CONSTRAINT "data_export_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "data_deletion_requests" ADD CONSTRAINT "data_deletion_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "data_deletion_items" ADD CONSTRAINT "data_deletion_items_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "data_deletion_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "critical_asset_versions" ADD CONSTRAINT "critical_asset_versions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "backup_recovery_events" ADD CONSTRAINT "backup_recovery_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
