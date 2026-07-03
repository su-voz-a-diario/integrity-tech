import { Injectable } from '@nestjs/common';
import { IamFacade, SessionUser } from '../iam.facade';
import { UserService } from './user.service';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';

@Injectable()
export class IamLocalFacade implements IamFacade {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
  ) {}

  async verifyUserPermission(userId: string, permission: string): Promise<boolean> {
    return this.userService.hasPermission(userId, permission);
  }

  async validateSession(token: string): Promise<SessionUser> {
    const user = await this.authService.verifyJwt(token);
    return this.sessionService.assertActiveSession(user);
  }

  issueSessionToken(user: SessionUser, expiresInSeconds?: number): string {
    return this.authService.issueJwt(user, expiresInSeconds);
  }
}
