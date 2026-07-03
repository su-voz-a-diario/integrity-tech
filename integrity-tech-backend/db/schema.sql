-- ============================================================================
-- ESQUEMA DE BASE DE DATOS: PLATAFORMA DE EVALUACIÓN EDTECH (EVALUARTEST)
-- DISEÑO: Monolito Modular con preparación para Microservicios (Shared-Nothing Logical Schema)
-- SGBD: PostgreSQL (13+)
-- ============================================================================

-- Habilitar extensión pgcrypto para generación estándar de UUID
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- MÓDULO 1: IDENTIDAD, ORGANIZACIONES Y SEGURIDAD (Tenant & Auth Domain)
-- ============================================================================

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT unique_email_per_org UNIQUE (organization_id, email)
);

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) UNIQUE NOT NULL, -- Ej: 'exam:create', 'exam:attempt'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- ============================================================================
-- MÓDULO 2: BANCO DE PREGUNTAS (Question Bank Domain)
-- ============================================================================

CREATE TABLE question_banks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL, -- Referencia Lógica (Módulo Identidad)
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID NOT NULL, -- Referencia Lógica (Módulo Identidad)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_bank_id UUID NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- Ej: 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'CODE_REACTIVE'
    content_jsonb JSONB NOT NULL, -- Estructura flexible para escalas Likert (1-5), opción múltiple y metadatos
    default_points NUMERIC(5,2) DEFAULT 1.00 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_default_points_non_negative CHECK (default_points >= 0.00)
);

-- ============================================================================
-- MÓDULO 3: CONFIGURACIÓN DE EXÁMENES (Exam Domain)
-- ============================================================================

CREATE TABLE exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL, -- Referencia Lógica (Módulo Identidad)
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration_minutes INT, -- NULL indica tiempo ilimitado
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    max_attempts INT DEFAULT 1 NOT NULL,
    passing_score NUMERIC(5,2) DEFAULT 0.00 NOT NULL,
    is_published BOOLEAN DEFAULT FALSE NOT NULL,
    created_by UUID NOT NULL, -- Referencia Lógica (Módulo Identidad)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_duration_positive CHECK (duration_minutes IS NULL OR duration_minutes > 0),
    CONSTRAINT chk_max_attempts_positive CHECK (max_attempts > 0),
    CONSTRAINT chk_passing_score_non_negative CHECK (passing_score >= 0.00),
    CONSTRAINT chk_valid_time_window CHECK (start_time IS NULL OR end_time IS NULL OR start_time < end_time)
);

-- Mapeo de preguntas a exámenes. 
-- Nota: question_id es una referencia lógica al banco de preguntas para permitir el desacoplamiento.
CREATE TABLE exam_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    question_id UUID NOT NULL, -- Referencia Lógica (Módulo Question Bank)
    points NUMERIC(5,2) DEFAULT 1.00 NOT NULL,
    sort_order INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_points_positive CHECK (points >= 0.00),
    CONSTRAINT chk_sort_order_non_negative CHECK (sort_order >= 0),
    CONSTRAINT unique_question_per_exam UNIQUE (exam_id, question_id)
);

-- ============================================================================
-- MÓDULO 4: EVALUACIÓN Y EJECUCIÓN (Evaluation & Ingestion Domain)
-- ============================================================================

CREATE TABLE exam_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL, -- Referencia Lógica (Módulo Exámenes)
    user_id UUID NOT NULL, -- Referencia Lógica (Módulo Identidad)
    status VARCHAR(50) DEFAULT 'IN_PROGRESS' NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE,
    score NUMERIC(5,2), -- NULL hasta que sea calificado
    score_details JSONB, -- Perfil psicométrico detallado agrupado por dimensiones (JSONB)
    nps_score INT, -- Puntuación de experiencia técnica NPS (0-10)
    feedback_text TEXT, -- Comentarios cualitativos de la experiencia
    ip_address VARCHAR(45), -- Soporta IPv4 e IPv6
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_status_enum CHECK (status IN ('IN_PROGRESS', 'SUBMITTED', 'GRADING', 'COMPLETED', 'ABANDONED')),
    CONSTRAINT chk_score_non_negative CHECK (score IS NULL OR score >= 0.00),
    CONSTRAINT chk_submission_time CHECK (submitted_at IS NULL OR submitted_at >= started_at)
);

-- Registros de respuestas de alta velocidad de escritura
CREATE TABLE answer_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_attempt_id UUID NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL, -- Referencia Lógica (Módulo Question Bank)
    response JSONB NOT NULL, -- Payload dinámico con la respuesta del alumno
    is_correct BOOLEAN, -- NULL si requiere calificación manual
    points_earned NUMERIC(5,2) DEFAULT 0.00 NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_points_earned_non_negative CHECK (points_earned >= 0.00),
    CONSTRAINT unique_response_per_attempt_question UNIQUE (exam_attempt_id, question_id)
);

-- Registros de telemetría y seguridad (Proctoring)
CREATE TABLE attempt_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_attempt_id UUID NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    risk_level VARCHAR(50) DEFAULT 'INFO' NOT NULL, -- INFO, WARNING, CRITICAL
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ============================================================================
-- 5. ÍNDICES DE RENDIMIENTO Y OPTIMIZACIÓN
-- ============================================================================

-- Módulo de Identidad
CREATE INDEX idx_users_org_id ON users(organization_id);
-- Búsqueda de permisos rápida al validar sesiones
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);

-- Módulo de Banco de Preguntas
CREATE INDEX idx_question_banks_org_id ON question_banks(organization_id);
CREATE INDEX idx_questions_bank_id ON questions(question_bank_id);

-- Módulo de Exámenes
CREATE INDEX idx_exams_org_id ON exams(organization_id);
CREATE INDEX idx_exam_questions_exam_id ON exam_questions(exam_id);

-- Módulo de Evaluación (Búsqueda cruzada de intentos de usuario y reportes de exámenes)
CREATE INDEX idx_exam_attempts_exam_id ON exam_attempts(exam_id);
CREATE INDEX idx_exam_attempts_user_id ON exam_attempts(user_id);
-- Índice compuesto de estado del examen para vistas del profesor (ej. ver cuántos están 'IN_PROGRESS')
CREATE INDEX idx_exam_attempts_exam_status ON exam_attempts(exam_id, status);

-- Tablas de Alta Frecuencia de Escritura (Optimización de Inserción y Búsqueda)
-- answer_submissions:
-- El índice único de (exam_attempt_id, question_id) ya crea implícitamente un índice B-Tree.
-- Como el primer campo es 'exam_attempt_id', PostgreSQL usará este índice para búsquedas como:
-- "SELECT * FROM answer_submissions WHERE exam_attempt_id = X". No se requiere un índice adicional simple para exam_attempt_id.

-- attempt_logs:
-- Para auditorías de un examen específico, necesitamos consultar logs por intento de forma secuencial.
CREATE INDEX idx_attempt_logs_attempt_id_time ON attempt_logs(exam_attempt_id, timestamp DESC);

-- Tabla de Mapeo LTI v1.3
CREATE TABLE lti_attempts_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID UNIQUE NOT NULL,
    lms_user_id VARCHAR(255) NOT NULL,
    lineitem_url TEXT NOT NULL,
    iss VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_lti_attempts_mapping_attempt FOREIGN KEY (attempt_id) REFERENCES exam_attempts(id) ON DELETE CASCADE
);

CREATE INDEX idx_lti_attempts_mapping_attempt_id ON lti_attempts_mapping(attempt_id);
