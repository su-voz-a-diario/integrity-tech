CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE "organizations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(255) NOT NULL,
  "slug" VARCHAR(255) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "password_hash" VARCHAR(255) NOT NULL,
  "first_name" VARCHAR(100) NOT NULL,
  "last_name" VARCHAR(100) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "pais" VARCHAR(100),
  "sector" VARCHAR(100),
  "nivel_educativo" VARCHAR(100),
  "tipo_puesto" VARCHAR(100),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "unique_email_per_org" ON "users"("organization_id", "email");
CREATE INDEX "idx_users_org_id" ON "users"("organization_id");

ALTER TABLE "users"
  ADD CONSTRAINT "users_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "roles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(50) NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

CREATE TABLE "permissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

CREATE TABLE "role_permissions" (
  "role_id" UUID NOT NULL,
  "permission_id" UUID NOT NULL,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id")
);

CREATE INDEX "idx_role_permissions_role_id" ON "role_permissions"("role_id");

ALTER TABLE "role_permissions"
  ADD CONSTRAINT "role_permissions_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "roles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "role_permissions"
  ADD CONSTRAINT "role_permissions_permission_id_fkey"
  FOREIGN KEY ("permission_id") REFERENCES "permissions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "user_roles" (
  "user_id" UUID NOT NULL,
  "role_id" UUID NOT NULL,
  CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role_id")
);

CREATE INDEX "idx_user_roles_user_id" ON "user_roles"("user_id");

ALTER TABLE "user_roles"
  ADD CONSTRAINT "user_roles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_roles"
  ADD CONSTRAINT "user_roles_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "roles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "question_banks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "question_banks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_question_banks_org_id" ON "question_banks"("organization_id");

CREATE TABLE "questions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "question_bank_id" UUID NOT NULL,
  "type" VARCHAR(50) NOT NULL,
  "content_jsonb" JSONB NOT NULL,
  "default_points" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "questions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chk_default_points_non_negative" CHECK ("default_points" >= 0.00)
);

CREATE INDEX "idx_questions_bank_id" ON "questions"("question_bank_id");

ALTER TABLE "questions"
  ADD CONSTRAINT "questions_question_bank_id_fkey"
  FOREIGN KEY ("question_bank_id") REFERENCES "question_banks"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "exams" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "duration_minutes" INTEGER,
  "start_time" TIMESTAMPTZ,
  "end_time" TIMESTAMPTZ,
  "max_attempts" INTEGER NOT NULL DEFAULT 1,
  "passing_score" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  "is_published" BOOLEAN NOT NULL DEFAULT false,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exams_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chk_duration_positive" CHECK ("duration_minutes" IS NULL OR "duration_minutes" > 0),
  CONSTRAINT "chk_max_attempts_positive" CHECK ("max_attempts" > 0),
  CONSTRAINT "chk_passing_score_non_negative" CHECK ("passing_score" >= 0.00),
  CONSTRAINT "chk_valid_time_window" CHECK ("start_time" IS NULL OR "end_time" IS NULL OR "start_time" < "end_time")
);

CREATE INDEX "idx_exams_org_id" ON "exams"("organization_id");

CREATE TABLE "exam_questions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "exam_id" UUID NOT NULL,
  "question_id" UUID NOT NULL,
  "points" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exam_questions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chk_points_positive" CHECK ("points" >= 0.00),
  CONSTRAINT "chk_sort_order_non_negative" CHECK ("sort_order" >= 0)
);

CREATE UNIQUE INDEX "unique_question_per_exam" ON "exam_questions"("exam_id", "question_id");
CREATE INDEX "idx_exam_questions_exam_id" ON "exam_questions"("exam_id");

ALTER TABLE "exam_questions"
  ADD CONSTRAINT "exam_questions_exam_id_fkey"
  FOREIGN KEY ("exam_id") REFERENCES "exams"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "exam_attempts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "exam_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "status" VARCHAR(50) NOT NULL DEFAULT 'IN_PROGRESS',
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submitted_at" TIMESTAMPTZ,
  "score" DECIMAL(5,2),
  "score_details" JSONB,
  "nps_score" INTEGER,
  "feedback_text" TEXT,
  "ip_address" VARCHAR(45),
  "user_agent" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exam_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chk_status_enum" CHECK ("status" IN ('IN_PROGRESS', 'SUBMITTED', 'GRADING', 'COMPLETED', 'ABANDONED')),
  CONSTRAINT "chk_score_non_negative" CHECK ("score" IS NULL OR "score" >= 0.00),
  CONSTRAINT "chk_submission_time" CHECK ("submitted_at" IS NULL OR "submitted_at" >= "started_at")
);

CREATE INDEX "idx_exam_attempts_exam_id" ON "exam_attempts"("exam_id");
CREATE INDEX "idx_exam_attempts_user_id" ON "exam_attempts"("user_id");
CREATE INDEX "idx_exam_attempts_exam_status" ON "exam_attempts"("exam_id", "status");

CREATE TABLE "answer_submissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "exam_attempt_id" UUID NOT NULL,
  "question_id" UUID NOT NULL,
  "response" JSONB NOT NULL,
  "is_correct" BOOLEAN,
  "points_earned" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  "tiempo_ms" INTEGER,
  "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "answer_submissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chk_points_earned_non_negative" CHECK ("points_earned" >= 0.00)
);

CREATE UNIQUE INDEX "unique_response_per_attempt_question" ON "answer_submissions"("exam_attempt_id", "question_id");

ALTER TABLE "answer_submissions"
  ADD CONSTRAINT "answer_submissions_exam_attempt_id_fkey"
  FOREIGN KEY ("exam_attempt_id") REFERENCES "exam_attempts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "attempt_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "exam_attempt_id" UUID NOT NULL,
  "event_type" VARCHAR(100) NOT NULL,
  "risk_level" VARCHAR(50) NOT NULL DEFAULT 'INFO',
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attempt_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_attempt_logs_attempt_id_time" ON "attempt_logs"("exam_attempt_id", "timestamp" DESC);

ALTER TABLE "attempt_logs"
  ADD CONSTRAINT "attempt_logs_exam_attempt_id_fkey"
  FOREIGN KEY ("exam_attempt_id") REFERENCES "exam_attempts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "lti_attempts_mapping" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "attempt_id" UUID NOT NULL,
  "lms_user_id" VARCHAR(255) NOT NULL,
  "lineitem_url" TEXT NOT NULL,
  "iss" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lti_attempts_mapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lti_attempts_mapping_attempt_id_key" ON "lti_attempts_mapping"("attempt_id");
CREATE INDEX "idx_lti_attempts_mapping_attempt_id" ON "lti_attempts_mapping"("attempt_id");

ALTER TABLE "lti_attempts_mapping"
  ADD CONSTRAINT "fk_lti_attempts_mapping_attempt"
  FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "candidate_invitations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "exam_id" UUID NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "candidate_name" VARCHAR(255) NOT NULL,
  "access_code" VARCHAR(50) NOT NULL,
  "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  "expires_at" TIMESTAMPTZ,
  "attempt_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "candidate_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "candidate_invitations_access_code_key" ON "candidate_invitations"("access_code");
CREATE UNIQUE INDEX "candidate_invitations_attempt_id_key" ON "candidate_invitations"("attempt_id");

CREATE TABLE "perfiles_puesto" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "nombre" VARCHAR(100) NOT NULL,
  "w_integridad" DECIMAL(5,4) NOT NULL,
  "w_personalidad" DECIMAL(5,4) NOT NULL,
  "w_cognitivo" DECIMAL(5,4) NOT NULL,
  "w_competencias" DECIMAL(5,4) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "perfiles_puesto_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "resultados_test" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "exam_attempt_id" UUID NOT NULL,
  "test_id" VARCHAR(50) NOT NULL,
  "puntaje_bruto" DECIMAL(10,2) NOT NULL,
  "percentil" DECIMAL(5,2),
  "theta" DOUBLE PRECISION,
  "theta_error" DOUBLE PRECISION,
  "theta_t" DOUBLE PRECISION,
  "theta_ci" DOUBLE PRECISION,
  "person_fit_lz" DOUBLE PRECISION,
  "aberrante" BOOLEAN NOT NULL DEFAULT false,
  "engagement" DOUBLE PRECISION,
  "irt_calculated" BOOLEAN NOT NULL DEFAULT false,
  "fecha_calculo" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "resultados_test_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "resultados_test_exam_attempt_id_test_id_key" ON "resultados_test"("exam_attempt_id", "test_id");

ALTER TABLE "resultados_test"
  ADD CONSTRAINT "resultados_test_exam_attempt_id_fkey"
  FOREIGN KEY ("exam_attempt_id") REFERENCES "exam_attempts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "baremos" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "test_id" VARCHAR(50) NOT NULL,
  "percentil" DECIMAL(5,2) NOT NULL,
  "puntaje_raw_min" DECIMAL(10,2) NOT NULL,
  "puntaje_raw_max" DECIMAL(10,2) NOT NULL,
  "fecha_actualizacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "baremos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "baremos_test_id_percentil_key" ON "baremos"("test_id", "percentil");

CREATE TABLE "resultados_globales" (
  "exam_attempt_id" UUID NOT NULL,
  "perfil_id" UUID NOT NULL,
  "iga" DECIMAL(5,2) NOT NULL,
  "recomendacion" VARCHAR(50) NOT NULL,
  "alertas" JSONB NOT NULL,
  "fecha_calculo" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "resultados_globales_pkey" PRIMARY KEY ("exam_attempt_id")
);

ALTER TABLE "resultados_globales"
  ADD CONSTRAINT "resultados_globales_exam_attempt_id_fkey"
  FOREIGN KEY ("exam_attempt_id") REFERENCES "exam_attempts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "resultados_globales"
  ADD CONSTRAINT "resultados_globales_perfil_id_fkey"
  FOREIGN KEY ("perfil_id") REFERENCES "perfiles_puesto"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "parametros_items" (
  "id" SERIAL NOT NULL,
  "test_id" VARCHAR(50) NOT NULL,
  "item_id" VARCHAR(50) NOT NULL,
  "modelo" VARCHAR(10) NOT NULL,
  "parametro_a" DOUBLE PRECISION NOT NULL,
  "parametro_b" DOUBLE PRECISION,
  "parametro_c1" DOUBLE PRECISION,
  "parametro_c2" DOUBLE PRECISION,
  "parametro_c3" DOUBLE PRECISION,
  "parametro_c4" DOUBLE PRECISION,
  "error_estandar" DOUBLE PRECISION,
  "fecha_calibracion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "flag_dif" BOOLEAN NOT NULL DEFAULT false,
  "p_value_ajuste" DOUBLE PRECISION,
  "rmsea_item" DOUBLE PRECISION,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "parametros_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "parametros_items_test_id_item_id_key" ON "parametros_items"("test_id", "item_id");

CREATE TABLE "baremos_dinamicos" (
  "id" SERIAL NOT NULL,
  "test_id" VARCHAR(50) NOT NULL,
  "pais" VARCHAR(100),
  "sector" VARCHAR(100),
  "nivel_educativo" VARCHAR(100),
  "tipo_puesto" VARCHAR(100),
  "theta_min" DOUBLE PRECISION NOT NULL,
  "theta_max" DOUBLE PRECISION NOT NULL,
  "percentil" INTEGER NOT NULL,
  "n_muestra" INTEGER NOT NULL,
  "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "baremos_dinamicos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "baremos_dinamicos_test_id_pais_sector_nivel_educativo_tipo_puesto_idx"
  ON "baremos_dinamicos"("test_id", "pais", "sector", "nivel_educativo", "tipo_puesto");

CREATE TABLE "dif_flags" (
  "id" SERIAL NOT NULL,
  "test_id" VARCHAR(50) NOT NULL,
  "item_id" VARCHAR(50) NOT NULL,
  "variable" VARCHAR(100) NOT NULL,
  "metodo" VARCHAR(100) NOT NULL,
  "p_value" DOUBLE PRECISION NOT NULL,
  "flag" BOOLEAN NOT NULL,
  "fecha" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dif_flags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "psychometric_quality_logs" (
  "id" SERIAL NOT NULL,
  "test_id" VARCHAR(50) NOT NULL,
  "fecha" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "n_attempts" INTEGER NOT NULL,
  "mean_theta" DOUBLE PRECISION NOT NULL,
  "sd_theta" DOUBLE PRECISION NOT NULL,
  "drift_alert" BOOLEAN NOT NULL DEFAULT false,
  "marginal_reliability" DOUBLE PRECISION NOT NULL DEFAULT 0.80,
  CONSTRAINT "psychometric_quality_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cut_scores" (
  "id" SERIAL NOT NULL,
  "test_id" VARCHAR(50) NOT NULL,
  "categoria" VARCHAR(100) NOT NULL,
  "theta_min" DOUBLE PRECISION NOT NULL,
  "theta_max" DOUBLE PRECISION,
  "orden" INTEGER NOT NULL,
  CONSTRAINT "cut_scores_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "parametros_items_historial" (
  "id" SERIAL NOT NULL,
  "test_id" VARCHAR(50) NOT NULL,
  "item_id" VARCHAR(50) NOT NULL,
  "modelo" VARCHAR(10) NOT NULL,
  "parametro_a" DOUBLE PRECISION NOT NULL,
  "parametro_b" DOUBLE PRECISION,
  "parametro_c1" DOUBLE PRECISION,
  "parametro_c2" DOUBLE PRECISION,
  "parametro_c3" DOUBLE PRECISION,
  "parametro_c4" DOUBLE PRECISION,
  "error_estandar" DOUBLE PRECISION,
  "p_value_ajuste" DOUBLE PRECISION,
  "rmsea_item" DOUBLE PRECISION,
  "flag_dif" BOOLEAN NOT NULL,
  "fecha_calibracion" TIMESTAMPTZ NOT NULL,
  "fecha_archivado" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "parametros_items_historial_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "continuous_norms" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "test_id" VARCHAR(50) NOT NULL,
  "pais" VARCHAR(100),
  "nivel_educativo" VARCHAR(100),
  "tipo_puesto" VARCHAR(100),
  "p5" DECIMAL(8,4) NOT NULL,
  "p10" DECIMAL(8,4) NOT NULL,
  "p25" DECIMAL(8,4) NOT NULL,
  "p50" DECIMAL(8,4) NOT NULL,
  "p75" DECIMAL(8,4) NOT NULL,
  "p90" DECIMAL(8,4) NOT NULL,
  "p95" DECIMAL(8,4) NOT NULL,
  "fecha_actualizacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "continuous_norms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "equating_coefficients" (
  "id" SERIAL NOT NULL,
  "test_id" VARCHAR(50) NOT NULL,
  "version_origen" VARCHAR(50) NOT NULL,
  "version_destino" VARCHAR(50) NOT NULL,
  "metodo" VARCHAR(50) NOT NULL DEFAULT 'mean_sigma',
  "coeficiente_a" DOUBLE PRECISION NOT NULL,
  "coeficiente_b" DOUBLE PRECISION NOT NULL,
  "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "equating_coefficients_pkey" PRIMARY KEY ("id")
);
