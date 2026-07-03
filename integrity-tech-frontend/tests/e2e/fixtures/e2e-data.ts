import { APIRequestContext, Page, expect } from '@playwright/test';

export const E2E = {
  apiBaseURL: process.env.E2E_API_BASE_URL || 'http://127.0.0.1:3001/api',
  frontendURL: process.env.E2E_FRONTEND_URL || 'http://127.0.0.1:3000',
  password: process.env.E2E_STAFF_PASSWORD || 'IntegrityE2E123!',
  orgA: 'e2e-org-a',
  orgB: 'e2e-org-b',
  examA: '00000000-0000-7000-8000-00000000e501',
  examB: '00000000-0000-7000-8000-00000000e502',
  users: {
    adminA: 'admin-a@e2e.integrity.test',
    recruiterA: 'recruiter-a@e2e.integrity.test',
    psychologistA: 'psychologist-a@e2e.integrity.test',
    evaluatorA: 'evaluator-a@e2e.integrity.test',
    recruiterB: 'recruiter-b@e2e.integrity.test',
  },
};

export type StaffSession = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    organizationId: string;
    organizationSlug: string;
    roles: string[];
    email: string;
  };
};

export type CandidateSession = {
  token: string;
  attemptId: string;
};

export async function loginStaff(request: APIRequestContext, email: string, organizationSlug = E2E.orgA): Promise<StaffSession> {
  const response = await request.post(`${E2E.apiBaseURL}/auth/login`, {
    data: { email, password: E2E.password, organizationSlug },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

export async function authGet(request: APIRequestContext, token: string, path: string) {
  return request.get(`${E2E.apiBaseURL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function authPost(request: APIRequestContext, token: string, path: string, data?: unknown) {
  return request.post(`${E2E.apiBaseURL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
}

export async function createInvitation(request: APIRequestContext, token: string, suffix: string) {
  const candidateEmail = `candidate-${suffix}@e2e.integrity.test`;
  const response = await authPost(request, token, '/evaluations/invitations', {
    candidateName: `Candidate ${suffix}`,
    email: candidateEmail,
    examId: E2E.examA,
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const body = await response.json();
  expect(body.accessCode).toMatch(/^IT-\d{6}$/);
  return { ...body, candidateEmail, candidateName: `Candidate ${suffix}` };
}

export async function claimInvitation(
  request: APIRequestContext,
  accessCode: string,
  candidateEmail: string,
  candidateName: string,
): Promise<CandidateSession> {
  const verify = await request.post(`${E2E.apiBaseURL}/evaluations/invitations/verify`, {
    data: { accessCode },
  });
  expect(verify.ok(), await verify.text()).toBeTruthy();

  const claim = await request.post(`${E2E.apiBaseURL}/evaluations/invitations/claim`, {
    data: { accessCode, email: candidateEmail, candidateName },
  });
  expect(claim.ok(), await claim.text()).toBeTruthy();
  const body = await claim.json();
  expect(body.token).toBeTruthy();
  expect(body.attemptId).toBeTruthy();
  return { token: body.token, attemptId: body.attemptId };
}

export async function acceptConsent(request: APIRequestContext, candidate: CandidateSession) {
  const response = await authPost(request, candidate.token, `/evaluations/attempts/${candidate.attemptId}/consent`, {
    consentVersion: 'candidate-consent-v1',
  });
  expect(response.ok(), await response.text()).toBeTruthy();
}

export async function loadSession(request: APIRequestContext, candidate: CandidateSession) {
  const response = await authGet(request, candidate.token, `/evaluations/attempts/${candidate.attemptId}/session`);
  expect(response.ok(), await response.text()).toBeTruthy();
  const body = await response.json();
  expect(body.questions.length).toBeGreaterThan(0);
  return body;
}

export async function answerAllQuestions(request: APIRequestContext, candidate: CandidateSession, session: any) {
  for (const question of session.questions) {
    const response =
      question.type === 'LIKERT'
        ? { value: 5 }
        : { selectedOptionId: question.content?.options?.[1]?.id || question.content?.options?.[0]?.id || 'b' };
    const submit = await authPost(request, candidate.token, `/evaluations/attempts/${candidate.attemptId}/submit`, {
      questionId: question.id,
      itemVersionId: question.itemVersionId || undefined,
      response,
      tiempoMs: 1200,
    });
    expect([200, 201, 202]).toContain(submit.status());
  }
}

export async function waitForReportReady(request: APIRequestContext, token: string, attemptId: string) {
  await expect
    .poll(async () => {
      const response = await authGet(request, token, `/evaluations/attempts/${attemptId}`);
      if (!response.ok()) return null;
      const body = await response.json();
      const itemVersionCount = body.governanceTrace?.itemVersionIds?.length || 0;
      return itemVersionCount > 0 ? body.governanceTrace.mode : null;
    }, { timeout: 15_000 })
    .not.toBeNull();
}

export async function seedAuthenticatedPage(page: Page, token: string) {
  await page.addInitScript((authToken) => {
    window.localStorage.setItem('auth-token', authToken);
  }, token);
}

export async function countQueuedAnswers(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('integrity-tech-offline-db-v1', 3);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('answers-queue')) db.createObjectStore('answers-queue', { keyPath: 'id' });
      };
    });

    return new Promise<number>((resolve, reject) => {
      const tx = db.transaction('answers-queue', 'readonly');
      const request = tx.objectStore('answers-queue').count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

export const tinyPngDataUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
