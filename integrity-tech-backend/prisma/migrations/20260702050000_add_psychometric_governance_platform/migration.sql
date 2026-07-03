CREATE TABLE "psychometric_categories" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "psychometric_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "competencies" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "competencies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "psychometric_scales" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "psychometric_scales_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "psychometric_subscales" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "scale_id" UUID NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "psychometric_subscales_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assessments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "status" VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  "created_by_user_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assessment_versions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "assessment_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "version" VARCHAR(50) NOT NULL,
  "status" VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "blueprint_json" JSONB NOT NULL,
  "content_hash" VARCHAR(128) NOT NULL,
  "published_at" TIMESTAMPTZ,
  "retired_at" TIMESTAMPTZ,
  "created_by_user_id" UUID,
  "approved_by_user_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assessment_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "item_code" VARCHAR(120) NOT NULL,
  "category_id" UUID,
  "competency_id" UUID,
  "scale_id" UUID,
  "subscale_id" UUID,
  "status" VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  "created_by_user_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "item_versions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "item_id" UUID NOT NULL,
  "version" VARCHAR(50) NOT NULL,
  "status" VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  "language" VARCHAR(10) NOT NULL DEFAULT 'es',
  "stem_json" JSONB NOT NULL,
  "scoring_key_json" JSONB,
  "tags" JSONB,
  "exposure_rate" DECIMAL(7,4),
  "difficulty" DOUBLE PRECISION,
  "discrimination" DOUBLE PRECISION,
  "expected_time_seconds" INTEGER,
  "content_hash" VARCHAR(128) NOT NULL,
  "published_at" TIMESTAMPTZ,
  "retired_at" TIMESTAMPTZ,
  "created_by_user_id" UUID,
  "approved_by_user_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "item_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assessment_version_items" (
  "assessment_version_id" UUID NOT NULL,
  "item_version_id" UUID NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "weight" DECIMAL(8,4) NOT NULL DEFAULT 1.00,
  "role" VARCHAR(50),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assessment_version_items_pkey" PRIMARY KEY ("assessment_version_id", "item_version_id")
);

CREATE TABLE "norm_groups" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "assessment_version_id" UUID NOT NULL,
  "code" VARCHAR(120) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "population_json" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "norm_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "norm_group_versions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "norm_group_id" UUID NOT NULL,
  "version" VARCHAR(50) NOT NULL,
  "status" VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  "population_json" JSONB NOT NULL,
  "norm_table_json" JSONB NOT NULL,
  "sample_size" INTEGER,
  "effective_from" TIMESTAMPTZ,
  "effective_to" TIMESTAMPTZ,
  "content_hash" VARCHAR(128) NOT NULL,
  "created_by_user_id" UUID,
  "approved_by_user_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "norm_group_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "scoring_models" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "assessment_version_id" UUID NOT NULL,
  "code" VARCHAR(120) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "model_type" VARCHAR(80) NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scoring_models_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "scoring_model_versions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "scoring_model_id" UUID NOT NULL,
  "version" VARCHAR(50) NOT NULL,
  "status" VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  "algorithm_key" VARCHAR(120) NOT NULL,
  "parameters_json" JSONB NOT NULL,
  "content_hash" VARCHAR(128) NOT NULL,
  "effective_from" TIMESTAMPTZ,
  "effective_to" TIMESTAMPTZ,
  "created_by_user_id" UUID,
  "approved_by_user_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scoring_model_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "report_templates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "assessment_version_id" UUID NOT NULL,
  "code" VARCHAR(120) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "audience" VARCHAR(80) NOT NULL DEFAULT 'STAFF',
  "description" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "report_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "report_template_versions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "report_template_id" UUID NOT NULL,
  "version" VARCHAR(50) NOT NULL,
  "status" VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  "template_json" JSONB NOT NULL,
  "interpretation_rules_json" JSONB,
  "content_hash" VARCHAR(128) NOT NULL,
  "effective_from" TIMESTAMPTZ,
  "effective_to" TIMESTAMPTZ,
  "created_by_user_id" UUID,
  "approved_by_user_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "report_template_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "report_issue_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "exam_attempt_id" UUID NOT NULL,
  "report_template_version_id" UUID NOT NULL,
  "issued_by_user_id" UUID,
  "governance_trace" JSONB NOT NULL,
  "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "report_issue_records_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "exam_attempts" ADD COLUMN "assessment_version_id" UUID;
ALTER TABLE "answer_submissions" ADD COLUMN "item_version_id" UUID;
ALTER TABLE "resultados_test" ADD COLUMN "scoring_model_version_id" UUID;
ALTER TABLE "resultados_test" ADD COLUMN "norm_group_version_id" UUID;
ALTER TABLE "resultados_test" ADD COLUMN "governance_trace" JSONB;
ALTER TABLE "resultados_globales" ADD COLUMN "scoring_model_version_id" UUID;
ALTER TABLE "resultados_globales" ADD COLUMN "norm_group_version_id" UUID;
ALTER TABLE "resultados_globales" ADD COLUMN "report_template_version_id" UUID;
ALTER TABLE "resultados_globales" ADD COLUMN "governance_trace" JSONB;

CREATE UNIQUE INDEX "psychometric_categories_organization_id_code_key" ON "psychometric_categories"("organization_id", "code");
CREATE INDEX "psychometric_categories_organization_id_name_idx" ON "psychometric_categories"("organization_id", "name");
CREATE UNIQUE INDEX "competencies_organization_id_code_key" ON "competencies"("organization_id", "code");
CREATE INDEX "competencies_organization_id_name_idx" ON "competencies"("organization_id", "name");
CREATE UNIQUE INDEX "psychometric_scales_organization_id_code_key" ON "psychometric_scales"("organization_id", "code");
CREATE INDEX "psychometric_scales_organization_id_name_idx" ON "psychometric_scales"("organization_id", "name");
CREATE UNIQUE INDEX "psychometric_subscales_scale_id_code_key" ON "psychometric_subscales"("scale_id", "code");
CREATE INDEX "psychometric_subscales_scale_id_name_idx" ON "psychometric_subscales"("scale_id", "name");
CREATE UNIQUE INDEX "assessments_organization_id_code_key" ON "assessments"("organization_id", "code");
CREATE INDEX "assessments_organization_id_status_idx" ON "assessments"("organization_id", "status");
CREATE UNIQUE INDEX "assessment_versions_assessment_id_version_key" ON "assessment_versions"("assessment_id", "version");
CREATE INDEX "assessment_versions_organization_id_status_idx" ON "assessment_versions"("organization_id", "status");
CREATE INDEX "assessment_versions_organization_id_published_at_idx" ON "assessment_versions"("organization_id", "published_at");
CREATE UNIQUE INDEX "items_organization_id_item_code_key" ON "items"("organization_id", "item_code");
CREATE INDEX "items_organization_id_status_idx" ON "items"("organization_id", "status");
CREATE INDEX "items_organization_id_category_id_idx" ON "items"("organization_id", "category_id");
CREATE INDEX "items_organization_id_competency_id_idx" ON "items"("organization_id", "competency_id");
CREATE UNIQUE INDEX "item_versions_item_id_version_key" ON "item_versions"("item_id", "version");
CREATE INDEX "item_versions_status_language_idx" ON "item_versions"("status", "language");
CREATE INDEX "assessment_version_items_assessment_version_id_sort_order_idx" ON "assessment_version_items"("assessment_version_id", "sort_order");
CREATE UNIQUE INDEX "norm_groups_organization_id_code_key" ON "norm_groups"("organization_id", "code");
CREATE INDEX "norm_groups_organization_id_assessment_version_id_idx" ON "norm_groups"("organization_id", "assessment_version_id");
CREATE UNIQUE INDEX "norm_group_versions_norm_group_id_version_key" ON "norm_group_versions"("norm_group_id", "version");
CREATE INDEX "norm_group_versions_status_effective_from_effective_to_idx" ON "norm_group_versions"("status", "effective_from", "effective_to");
CREATE UNIQUE INDEX "scoring_models_organization_id_code_key" ON "scoring_models"("organization_id", "code");
CREATE INDEX "scoring_models_organization_id_assessment_version_id_idx" ON "scoring_models"("organization_id", "assessment_version_id");
CREATE UNIQUE INDEX "scoring_model_versions_scoring_model_id_version_key" ON "scoring_model_versions"("scoring_model_id", "version");
CREATE INDEX "scoring_model_versions_status_effective_from_effective_to_idx" ON "scoring_model_versions"("status", "effective_from", "effective_to");
CREATE UNIQUE INDEX "report_templates_organization_id_code_key" ON "report_templates"("organization_id", "code");
CREATE INDEX "report_templates_organization_id_assessment_version_id_idx" ON "report_templates"("organization_id", "assessment_version_id");
CREATE UNIQUE INDEX "report_template_versions_report_template_id_version_key" ON "report_template_versions"("report_template_id", "version");
CREATE INDEX "report_template_versions_status_effective_from_effective_to_idx" ON "report_template_versions"("status", "effective_from", "effective_to");
CREATE INDEX "report_issue_records_organization_id_exam_attempt_id_idx" ON "report_issue_records"("organization_id", "exam_attempt_id");
CREATE INDEX "report_issue_records_report_template_version_id_idx" ON "report_issue_records"("report_template_version_id");
CREATE INDEX "exam_attempts_organization_id_assessment_version_id_idx" ON "exam_attempts"("organization_id", "assessment_version_id");
CREATE INDEX "answer_submissions_item_version_id_idx" ON "answer_submissions"("item_version_id");
CREATE INDEX "resultados_test_scoring_model_version_id_idx" ON "resultados_test"("scoring_model_version_id");
CREATE INDEX "resultados_test_norm_group_version_id_idx" ON "resultados_test"("norm_group_version_id");
CREATE INDEX "resultados_globales_scoring_model_version_id_idx" ON "resultados_globales"("scoring_model_version_id");
CREATE INDEX "resultados_globales_norm_group_version_id_idx" ON "resultados_globales"("norm_group_version_id");
CREATE INDEX "resultados_globales_report_template_version_id_idx" ON "resultados_globales"("report_template_version_id");

ALTER TABLE "psychometric_categories" ADD CONSTRAINT "psychometric_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "psychometric_scales" ADD CONSTRAINT "psychometric_scales_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "psychometric_subscales" ADD CONSTRAINT "psychometric_subscales_scale_id_fkey" FOREIGN KEY ("scale_id") REFERENCES "psychometric_scales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assessment_versions" ADD CONSTRAINT "assessment_versions_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "items" ADD CONSTRAINT "items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "items" ADD CONSTRAINT "items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "psychometric_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "items" ADD CONSTRAINT "items_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "items" ADD CONSTRAINT "items_scale_id_fkey" FOREIGN KEY ("scale_id") REFERENCES "psychometric_scales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "items" ADD CONSTRAINT "items_subscale_id_fkey" FOREIGN KEY ("subscale_id") REFERENCES "psychometric_subscales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "item_versions" ADD CONSTRAINT "item_versions_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assessment_version_items" ADD CONSTRAINT "assessment_version_items_assessment_version_id_fkey" FOREIGN KEY ("assessment_version_id") REFERENCES "assessment_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assessment_version_items" ADD CONSTRAINT "assessment_version_items_item_version_id_fkey" FOREIGN KEY ("item_version_id") REFERENCES "item_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "norm_groups" ADD CONSTRAINT "norm_groups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "norm_groups" ADD CONSTRAINT "norm_groups_assessment_version_id_fkey" FOREIGN KEY ("assessment_version_id") REFERENCES "assessment_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "norm_group_versions" ADD CONSTRAINT "norm_group_versions_norm_group_id_fkey" FOREIGN KEY ("norm_group_id") REFERENCES "norm_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scoring_models" ADD CONSTRAINT "scoring_models_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "scoring_models" ADD CONSTRAINT "scoring_models_assessment_version_id_fkey" FOREIGN KEY ("assessment_version_id") REFERENCES "assessment_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "scoring_model_versions" ADD CONSTRAINT "scoring_model_versions_scoring_model_id_fkey" FOREIGN KEY ("scoring_model_id") REFERENCES "scoring_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "report_templates" ADD CONSTRAINT "report_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "report_templates" ADD CONSTRAINT "report_templates_assessment_version_id_fkey" FOREIGN KEY ("assessment_version_id") REFERENCES "assessment_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "report_template_versions" ADD CONSTRAINT "report_template_versions_report_template_id_fkey" FOREIGN KEY ("report_template_id") REFERENCES "report_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "report_issue_records" ADD CONSTRAINT "report_issue_records_exam_attempt_id_fkey" FOREIGN KEY ("exam_attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "report_issue_records" ADD CONSTRAINT "report_issue_records_report_template_version_id_fkey" FOREIGN KEY ("report_template_version_id") REFERENCES "report_template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_assessment_version_id_fkey" FOREIGN KEY ("assessment_version_id") REFERENCES "assessment_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "answer_submissions" ADD CONSTRAINT "answer_submissions_item_version_id_fkey" FOREIGN KEY ("item_version_id") REFERENCES "item_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "resultados_test" ADD CONSTRAINT "resultados_test_scoring_model_version_id_fkey" FOREIGN KEY ("scoring_model_version_id") REFERENCES "scoring_model_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "resultados_test" ADD CONSTRAINT "resultados_test_norm_group_version_id_fkey" FOREIGN KEY ("norm_group_version_id") REFERENCES "norm_group_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "resultados_globales" ADD CONSTRAINT "resultados_globales_scoring_model_version_id_fkey" FOREIGN KEY ("scoring_model_version_id") REFERENCES "scoring_model_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "resultados_globales" ADD CONSTRAINT "resultados_globales_norm_group_version_id_fkey" FOREIGN KEY ("norm_group_version_id") REFERENCES "norm_group_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "resultados_globales" ADD CONSTRAINT "resultados_globales_report_template_version_id_fkey" FOREIGN KEY ("report_template_version_id") REFERENCES "report_template_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
