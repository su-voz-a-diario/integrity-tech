export interface SessionUser {
  userId: string;
  organizationId: string;
  email: string;
  roles: string[];
}

export abstract class IamFacade {
  /**
   * Verifica si un usuario posee un permiso específico (RBAC).
   */
  abstract verifyUserPermission(userId: string, permission: string): Promise<boolean>;

  /**
   * Valida un token JWT de sesión y retorna la información básica del usuario.
   */
  abstract validateSession(token: string): Promise<SessionUser>;

  /**
   * Firma un token JWT de sesión para un usuario previamente validado.
   */
  abstract issueSessionToken(user: SessionUser, expiresInSeconds?: number): string;
}
