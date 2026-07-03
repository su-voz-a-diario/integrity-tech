export const PERMISSIONS = {
  ORGANIZATION_MANAGE: 'organization.manage',
  USERS_MANAGE: 'users.manage',
  ROLES_MANAGE: 'roles.manage',
  INVITATIONS_CREATE: 'invitations.create',
  INVITATIONS_READ: 'invitations.read',
  ATTEMPTS_READ: 'attempts.read',
  ATTEMPTS_UPDATE: 'attempts.update',
  REPORTS_READ: 'reports.read',
  PSYCHOMETRICS_READ: 'psychometrics.read',
  PSYCHOMETRICS_WRITE: 'psychometrics.write',
  AUDIT_READ: 'audit.read',
  ADMIN_MANAGE: 'admin.manage',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
