import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SessionUser } from '../iam.facade';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): SessionUser => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
