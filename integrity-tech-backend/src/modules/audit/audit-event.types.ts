export type AuditActorType = 'STAFF' | 'CANDIDATE' | 'SYSTEM';

export const AUDIT_ACTIONS = {
  AUTH_LOGIN_SUCCESS: 'auth.login.success',
  AUTH_LOGIN_FAILED: 'auth.login.failed',
  AUTH_REFRESH: 'auth.refresh',
  AUTH_LOGOUT: 'auth.logout',
  INVITATION_CREATED: 'invitation.created',
  INVITATION_VERIFIED: 'invitation.verified',
  INVITATION_CLAIMED: 'invitation.claimed',
  EXAM_SESSION_ACCESSED: 'exam.session.accessed',
  ANSWER_SUBMITTED: 'answer.submitted',
  ATTEMPT_FINALIZED: 'attempt.finalized',
  REPORT_ACCESSED: 'report.accessed',
  IGA_RECALCULATED: 'iga.recalculated',
  PSYCHOMETRICS_READ: 'psychometrics.read',
  PSYCHOMETRICS_WRITE: 'psychometrics.write',
  CONSENT_ACCEPTED: 'candidate.consent.accepted',
  CONSENT_VIEWED: 'candidate.consent.viewed',
  RATE_LIMIT_EXCEEDED: 'security.rate_limit.exceeded',
  REQUEST_REJECTED: 'security.request.rejected',
  PUBLIC_INVITATION_VERIFY_FAILED: 'public.invitation.verify.failed',
  PUBLIC_INVITATION_CLAIM_FAILED: 'public.invitation.claim.failed',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export interface AuditRequestMetadata {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface RecordAuditEventInput {
  organizationId?: string | null;
  actorUserId?: string | null;
  actorType: AuditActorType;
  action: AuditAction | string;
  resourceType: string;
  resourceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, any> | null;
}
