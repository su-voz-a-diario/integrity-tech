import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type JsonObject = Record<string, unknown>;

const apiBaseUrl = process.env.SMOKE_API_BASE_URL || process.env.E2E_API_BASE_URL;
const staffEmail = process.env.SMOKE_STAFF_EMAIL || 'recruiter-a@e2e.integrity.test';
const adminEmail = process.env.SMOKE_ADMIN_EMAIL || 'admin-a@e2e.integrity.test';
const staffPassword = process.env.SMOKE_STAFF_PASSWORD || process.env.E2E_STAFF_PASSWORD || 'IntegrityE2E123!';
const organizationSlug = process.env.SMOKE_ORGANIZATION_SLUG || 'e2e-org-a';
const examId = process.env.SMOKE_EXAM_ID || '00000000-0000-7000-8000-00000000e501';

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertTableExists(tableName: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT to_regclass('public.${tableName}') IS NOT NULL AS "exists"`,
  );
  assertCondition(rows[0]?.exists, `Missing required table: ${tableName}`);
}

async function validateDatabaseShape() {
  const requiredTables = [
    'organizations',
    'users',
    'roles',
    'permissions',
    'user_sessions',
    'candidate_invitations',
    'exam_attempts',
    'answer_submissions',
    'audit_events',
    'candidate_consents',
    'assessments',
    'assessment_versions',
    'items',
    'item_versions',
    'private_files',
  ];

  for (const table of requiredTables) {
    await assertTableExists(table);
  }

  const pgcrypto = await prisma.$queryRaw<Array<{ installed: boolean }>>`
    SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') AS installed
  `;
  assertCondition(pgcrypto[0]?.installed, 'pgcrypto extension is not installed');
}

async function validateSeedData() {
  const organization = await prisma.organization.findUnique({ where: { slug: organizationSlug } });
  assertCondition(organization, `Missing smoke organization: ${organizationSlug}`);

  const recruiter = await prisma.user.findFirst({
    where: { organizationId: organization.id, email: staffEmail, isActive: true },
  });
  assertCondition(recruiter, `Missing active smoke staff user: ${staffEmail}`);

  const exam = await prisma.exam.findFirst({
    where: { id: examId, organizationId: organization.id, isPublished: true },
  });
  assertCondition(exam, `Missing published smoke exam: ${examId}`);

  const assessmentVersion = await prisma.assessmentVersion.findFirst({
    where: {
      organizationId: organization.id,
      status: 'PUBLISHED',
      itemLinks: { some: {} },
    },
    include: { itemLinks: true },
  });
  assertCondition(assessmentVersion, 'Missing published assessment version with item links');
}

async function requestJson(path: string, options: RequestInit = {}) {
  assertCondition(apiBaseUrl, 'SMOKE_API_BASE_URL is required for HTTP smoke flow');
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body: JsonObject | JsonObject[] | null = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }
  if (!response.ok) {
    throw new Error(`HTTP smoke failed ${response.status} ${path}: ${text}`);
  }
  return body as any;
}

async function authGet(token: string, path: string) {
  return requestJson(path, { headers: { authorization: `Bearer ${token}` } });
}

async function authPost(token: string, path: string, data?: unknown) {
  return requestJson(path, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}

async function runHttpSmokeFlow() {
  if (!apiBaseUrl) {
    console.log('[smoke] SMOKE_API_BASE_URL not set; database smoke completed, HTTP flow skipped.');
    return;
  }

  const login = await requestJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: staffEmail, password: staffPassword, organizationSlug }),
  });
  const accessToken = login.accessToken as string;
  assertCondition(accessToken, 'Staff login did not return accessToken');

  const suffix = `${Date.now()}`;
  const candidateEmail = `smoke-${suffix}@integrity.test`;
  const candidateName = `Smoke Candidate ${suffix}`;
  const invitation = await authPost(accessToken, '/evaluations/invitations', {
    candidateName,
    email: candidateEmail,
    examId,
  });
  assertCondition(invitation.accessCode, 'Invitation creation did not return accessCode');

  await requestJson('/evaluations/invitations/verify', {
    method: 'POST',
    body: JSON.stringify({ accessCode: invitation.accessCode }),
  });

  const claimed = await requestJson('/evaluations/invitations/claim', {
    method: 'POST',
    body: JSON.stringify({
      accessCode: invitation.accessCode,
      email: candidateEmail,
      candidateName,
    }),
  });
  const candidateToken = claimed.token as string;
  const attemptId = claimed.attemptId as string;
  assertCondition(candidateToken && attemptId, 'Invitation claim did not return candidate token and attemptId');

  await authPost(candidateToken, `/evaluations/attempts/${attemptId}/consent`, {
    consentVersion: 'candidate-consent-v1',
  });

  const session = await authGet(candidateToken, `/evaluations/attempts/${attemptId}/session`);
  const questions = session.questions as Array<{ id: string; itemVersionId?: string; type: string; content?: any }>;
  assertCondition(Array.isArray(questions) && questions.length > 0, 'Session did not return questions');

  for (const question of questions) {
    await authPost(candidateToken, `/evaluations/attempts/${attemptId}/submit`, {
      questionId: question.id,
      itemVersionId: question.itemVersionId,
      response:
        question.type === 'LIKERT'
          ? { value: 5 }
          : { selectedOptionId: question.content?.options?.[0]?.id || 'a' },
      tiempoMs: 1000,
    });
  }

  await authPost(candidateToken, `/evaluations/attempts/${attemptId}/finalize`);

  const adminLogin = await requestJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: adminEmail, password: staffPassword, organizationSlug }),
  });
  const adminToken = adminLogin.accessToken as string;
  assertCondition(adminToken, 'Admin login did not return accessToken');

  const report = await authGet(accessToken, `/evaluations/attempts/${attemptId}`);
  assertCondition(report.email === candidateEmail, 'Report endpoint did not return the smoke candidate');
  assertCondition(report.governanceTrace, 'Report response is missing governanceTrace');

  const auditEvents = await authGet(adminToken, `/audit/events?resourceId=${attemptId}`);
  assertCondition(Array.isArray(auditEvents), 'Audit endpoint did not return an array');
  assertCondition(auditEvents.length > 0, 'Smoke flow did not produce audit events');
}

async function main() {
  await validateDatabaseShape();
  await validateSeedData();
  await runHttpSmokeFlow();
  console.log('[smoke] Integrity Test smoke validation completed.');
}

main()
  .catch((error) => {
    console.error(`[smoke] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
