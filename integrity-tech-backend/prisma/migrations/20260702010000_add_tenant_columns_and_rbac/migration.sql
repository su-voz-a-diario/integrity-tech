ALTER TABLE "candidate_invitations" ADD COLUMN "organization_id" UUID;
ALTER TABLE "candidate_invitations" ADD COLUMN "created_by_user_id" UUID;
UPDATE "candidate_invitations" ci
SET "organization_id" = e."organization_id"
FROM "exams" e
WHERE ci."exam_id" = e."id";
ALTER TABLE "candidate_invitations" ALTER COLUMN "organization_id" SET NOT NULL;
CREATE INDEX "candidate_invitations_organization_id_status_created_at_idx"
  ON "candidate_invitations"("organization_id", "status", "created_at");
ALTER TABLE "candidate_invitations"
  ADD CONSTRAINT "candidate_invitations_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "exam_attempts" ADD COLUMN "organization_id" UUID;
UPDATE "exam_attempts" ea
SET "organization_id" = e."organization_id"
FROM "exams" e
WHERE ea."exam_id" = e."id";
ALTER TABLE "exam_attempts" ALTER COLUMN "organization_id" SET NOT NULL;
CREATE INDEX "exam_attempts_organization_id_user_id_status_idx"
  ON "exam_attempts"("organization_id", "user_id", "status");
CREATE INDEX "exam_attempts_organization_id_exam_id_status_idx"
  ON "exam_attempts"("organization_id", "exam_id", "status");
ALTER TABLE "exam_attempts"
  ADD CONSTRAINT "exam_attempts_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "perfiles_puesto" ADD COLUMN "organization_id" UUID;
UPDATE "perfiles_puesto"
SET "organization_id" = (SELECT "id" FROM "organizations" ORDER BY "created_at" ASC LIMIT 1)
WHERE "organization_id" IS NULL;
ALTER TABLE "perfiles_puesto" ALTER COLUMN "organization_id" SET NOT NULL;
CREATE INDEX "perfiles_puesto_organization_id_idx" ON "perfiles_puesto"("organization_id");
ALTER TABLE "perfiles_puesto"
  ADD CONSTRAINT "perfiles_puesto_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "baremos" ADD COLUMN "organization_id" UUID;
UPDATE "baremos" SET "organization_id" = (SELECT "id" FROM "organizations" ORDER BY "created_at" ASC LIMIT 1);
ALTER TABLE "baremos" ALTER COLUMN "organization_id" SET NOT NULL;
DROP INDEX IF EXISTS "baremos_test_id_percentil_key";
CREATE UNIQUE INDEX "baremos_organization_id_test_id_percentil_key"
  ON "baremos"("organization_id", "test_id", "percentil");
CREATE INDEX "baremos_organization_id_test_id_idx" ON "baremos"("organization_id", "test_id");

ALTER TABLE "parametros_items" ADD COLUMN "organization_id" UUID;
UPDATE "parametros_items" SET "organization_id" = (SELECT "id" FROM "organizations" ORDER BY "created_at" ASC LIMIT 1);
ALTER TABLE "parametros_items" ALTER COLUMN "organization_id" SET NOT NULL;
DROP INDEX IF EXISTS "parametros_items_test_id_item_id_key";
CREATE UNIQUE INDEX "parametros_items_organization_id_test_id_item_id_key"
  ON "parametros_items"("organization_id", "test_id", "item_id");
CREATE INDEX "parametros_items_organization_id_test_id_idx" ON "parametros_items"("organization_id", "test_id");

ALTER TABLE "baremos_dinamicos" ADD COLUMN "organization_id" UUID;
UPDATE "baremos_dinamicos" SET "organization_id" = (SELECT "id" FROM "organizations" ORDER BY "created_at" ASC LIMIT 1);
ALTER TABLE "baremos_dinamicos" ALTER COLUMN "organization_id" SET NOT NULL;
DROP INDEX IF EXISTS "baremos_dinamicos_test_id_pais_sector_nivel_educativo_tipo_puesto_idx";
CREATE INDEX "baremos_dinamicos_organization_id_test_id_pais_sector_nivel_educativo_tipo_puesto_idx"
  ON "baremos_dinamicos"("organization_id", "test_id", "pais", "sector", "nivel_educativo", "tipo_puesto");

ALTER TABLE "dif_flags" ADD COLUMN "organization_id" UUID;
UPDATE "dif_flags" SET "organization_id" = (SELECT "id" FROM "organizations" ORDER BY "created_at" ASC LIMIT 1);
ALTER TABLE "dif_flags" ALTER COLUMN "organization_id" SET NOT NULL;
CREATE INDEX "dif_flags_organization_id_test_id_idx" ON "dif_flags"("organization_id", "test_id");

ALTER TABLE "psychometric_quality_logs" ADD COLUMN "organization_id" UUID;
UPDATE "psychometric_quality_logs" SET "organization_id" = (SELECT "id" FROM "organizations" ORDER BY "created_at" ASC LIMIT 1);
ALTER TABLE "psychometric_quality_logs" ALTER COLUMN "organization_id" SET NOT NULL;
CREATE INDEX "psychometric_quality_logs_organization_id_test_id_fecha_idx"
  ON "psychometric_quality_logs"("organization_id", "test_id", "fecha");

ALTER TABLE "cut_scores" ADD COLUMN "organization_id" UUID;
UPDATE "cut_scores" SET "organization_id" = (SELECT "id" FROM "organizations" ORDER BY "created_at" ASC LIMIT 1);
ALTER TABLE "cut_scores" ALTER COLUMN "organization_id" SET NOT NULL;
CREATE INDEX "cut_scores_organization_id_test_id_idx" ON "cut_scores"("organization_id", "test_id");

ALTER TABLE "parametros_items_historial" ADD COLUMN "organization_id" UUID;
UPDATE "parametros_items_historial" SET "organization_id" = (SELECT "id" FROM "organizations" ORDER BY "created_at" ASC LIMIT 1);
ALTER TABLE "parametros_items_historial" ALTER COLUMN "organization_id" SET NOT NULL;
CREATE INDEX "parametros_items_historial_organization_id_test_id_fecha_archivado_idx"
  ON "parametros_items_historial"("organization_id", "test_id", "fecha_archivado");

ALTER TABLE "continuous_norms" ADD COLUMN "organization_id" UUID;
UPDATE "continuous_norms" SET "organization_id" = (SELECT "id" FROM "organizations" ORDER BY "created_at" ASC LIMIT 1);
ALTER TABLE "continuous_norms" ALTER COLUMN "organization_id" SET NOT NULL;
CREATE INDEX "continuous_norms_organization_id_test_id_idx" ON "continuous_norms"("organization_id", "test_id");

ALTER TABLE "equating_coefficients" ADD COLUMN "organization_id" UUID;
UPDATE "equating_coefficients" SET "organization_id" = (SELECT "id" FROM "organizations" ORDER BY "created_at" ASC LIMIT 1);
ALTER TABLE "equating_coefficients" ALTER COLUMN "organization_id" SET NOT NULL;
CREATE INDEX "equating_coefficients_organization_id_test_id_idx" ON "equating_coefficients"("organization_id", "test_id");
