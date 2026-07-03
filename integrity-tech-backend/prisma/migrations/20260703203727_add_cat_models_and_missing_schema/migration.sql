/*
  Warnings:

  - A unique constraint covering the columns `[organization_id,email_hash]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "CatTestType" AS ENUM ('COGNITIVE', 'COMPETENCY');

-- CreateEnum
CREATE TYPE "CatFirstItemMethod" AS ENUM ('PRIOR_JOB_PROFILE', 'PRIOR_EDUCATION', 'PRIOR_MEDIUM');

-- CreateEnum
CREATE TYPE "CatSessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'TERMINATED_BY_TIME', 'ABANDONED');

-- DropIndex
DROP INDEX "idx_attempt_logs_attempt_id_time";

-- DropIndex
DROP INDEX "idx_exam_attempts_exam_id";

-- DropIndex
DROP INDEX "idx_exam_attempts_exam_status";

-- DropIndex
DROP INDEX "idx_exam_attempts_user_id";

-- DropIndex
DROP INDEX "idx_exam_questions_exam_id";

-- DropIndex
DROP INDEX "idx_exams_org_id";

-- DropIndex
DROP INDEX "idx_lti_attempts_mapping_attempt_id";

-- DropIndex
DROP INDEX "idx_question_banks_org_id";

-- DropIndex
DROP INDEX "idx_questions_bank_id";

-- DropIndex
DROP INDEX "idx_role_permissions_role_id";

-- DropIndex
DROP INDEX "idx_user_roles_user_id";

-- DropIndex
DROP INDEX "idx_users_org_id";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_hash" VARCHAR(64);

-- CreateTable
CREATE TABLE "cat_item_banks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "test_type" "CatTestType" NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cat_item_banks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cat_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bank_id" UUID NOT NULL,
    "item_code" VARCHAR(120) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "difficulty" DOUBLE PRECISION NOT NULL,
    "discrimination" DOUBLE PRECISION NOT NULL,
    "guessing" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "upper_asymptote" DOUBLE PRECISION,
    "content" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cat_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cat_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bank_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "min_items" INTEGER NOT NULL DEFAULT 10,
    "max_items" INTEGER NOT NULL DEFAULT 30,
    "max_time_seconds" INTEGER,
    "stopping_se" DOUBLE PRECISION NOT NULL DEFAULT 0.35,
    "first_item_method" "CatFirstItemMethod" NOT NULL DEFAULT 'PRIOR_MEDIUM',
    "exposure_control" BOOLEAN NOT NULL DEFAULT true,
    "max_exposure_rate" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "rapid_guessing_threshold_ms" INTEGER NOT NULL DEFAULT 2000,
    "allow_extra_items_on_rapid" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cat_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cat_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "bank_id" UUID NOT NULL,
    "config_id" UUID NOT NULL,
    "start_time" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_time" TIMESTAMPTZ,
    "final_theta" DOUBLE PRECISION,
    "final_se" DOUBLE PRECISION,
    "items_administered" INTEGER NOT NULL DEFAULT 0,
    "status" "CatSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "log" JSONB,
    "current_item_id" UUID,

    CONSTRAINT "cat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cat_responses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "response" VARCHAR(255),
    "is_correct" BOOLEAN,
    "response_time_ms" INTEGER NOT NULL,
    "rapid_guess" BOOLEAN NOT NULL DEFAULT false,
    "theta_after" DOUBLE PRECISION,
    "se_after" DOUBLE PRECISION,

    CONSTRAINT "cat_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cat_item_exposures" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "item_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "times_administered" INTEGER NOT NULL DEFAULT 0,
    "times_eligible" INTEGER NOT NULL DEFAULT 0,
    "exposure_rate" DOUBLE PRECISION,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cat_item_exposures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_business_metrics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "cost_per_hire" DOUBLE PRECISION,
    "avg_salary" DOUBLE PRECISION,
    "annual_hires" INTEGER,
    "selection_budget" DOUBLE PRECISION,
    "retention_cost" DOUBLE PRECISION,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_business_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_performance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "employee_id" VARCHAR(100) NOT NULL,
    "test_score" DOUBLE PRECISION NOT NULL,
    "performance" DOUBLE PRECISION NOT NULL,
    "hire_date" TIMESTAMPTZ NOT NULL,
    "department" VARCHAR(100),

    CONSTRAINT "employee_performance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benchmark_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sector" VARCHAR(100) NOT NULL,
    "size" VARCHAR(50) NOT NULL,
    "metric" VARCHAR(50) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "sample_size" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benchmark_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cat_item_banks_organization_id_test_type_key" ON "cat_item_banks"("organization_id", "test_type");

-- CreateIndex
CREATE UNIQUE INDEX "cat_items_bank_id_item_code_key" ON "cat_items"("bank_id", "item_code");

-- CreateIndex
CREATE UNIQUE INDEX "cat_configs_organization_id_bank_id_key" ON "cat_configs"("organization_id", "bank_id");

-- CreateIndex
CREATE UNIQUE INDEX "cat_item_exposures_item_id_organization_id_key" ON "cat_item_exposures"("item_id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_business_metrics_organization_id_key" ON "organization_business_metrics"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_organization_id_email_hash_key" ON "users"("organization_id", "email_hash");

-- RenameForeignKey
ALTER TABLE "lti_attempts_mapping" RENAME CONSTRAINT "fk_lti_attempts_mapping_attempt" TO "lti_attempts_mapping_attempt_id_fkey";

-- AddForeignKey
ALTER TABLE "cat_item_banks" ADD CONSTRAINT "cat_item_banks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_items" ADD CONSTRAINT "cat_items_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "cat_item_banks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_configs" ADD CONSTRAINT "cat_configs_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "cat_item_banks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_configs" ADD CONSTRAINT "cat_configs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_sessions" ADD CONSTRAINT "cat_sessions_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "cat_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_responses" ADD CONSTRAINT "cat_responses_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "cat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_responses" ADD CONSTRAINT "cat_responses_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "cat_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_item_exposures" ADD CONSTRAINT "cat_item_exposures_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "cat_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_item_exposures" ADD CONSTRAINT "cat_item_exposures_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_business_metrics" ADD CONSTRAINT "organization_business_metrics_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_performance" ADD CONSTRAINT "employee_performance_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "unique_response_per_attempt_question" RENAME TO "answer_submissions_exam_attempt_id_question_id_key";

-- RenameIndex
ALTER INDEX "baremos_dinamicos_organization_id_test_id_pais_sector_nivel_edu" RENAME TO "baremos_dinamicos_organization_id_test_id_pais_sector_nivel_idx";

-- RenameIndex
ALTER INDEX "critical_asset_versions_organization_id_asset_type_asset_key_st" RENAME TO "critical_asset_versions_organization_id_asset_type_asset_ke_idx";

-- RenameIndex
ALTER INDEX "critical_asset_versions_organization_id_asset_type_asset_key_ve" RENAME TO "critical_asset_versions_organization_id_asset_type_asset_ke_key";

-- RenameIndex
ALTER INDEX "data_deletion_requests_organization_id_subject_type_subject_id_" RENAME TO "data_deletion_requests_organization_id_subject_type_subject_idx";

-- RenameIndex
ALTER INDEX "data_lifecycle_records_organization_id_resource_type_resource_i" RENAME TO "data_lifecycle_records_organization_id_resource_type_resour_key";

-- RenameIndex
ALTER INDEX "unique_question_per_exam" RENAME TO "exam_questions_exam_id_question_id_key";

-- RenameIndex
ALTER INDEX "parametros_items_historial_organization_id_test_id_fecha_archiv" RENAME TO "parametros_items_historial_organization_id_test_id_fecha_ar_idx";

-- RenameIndex
ALTER INDEX "unique_email_per_org" RENAME TO "users_organization_id_email_key";
