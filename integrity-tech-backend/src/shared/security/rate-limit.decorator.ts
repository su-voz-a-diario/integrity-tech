import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'integrity:rate-limit';

export type RateLimitScope =
  | 'auth-login'
  | 'auth-refresh'
  | 'invitation-verify'
  | 'invitation-claim'
  | 'answer-submit'
  | 'attempt-finalize'
  | 'candidate-consent'
  | 'psychometrics-write';

export interface RateLimitOptions {
  scope: RateLimitScope;
  limit: number;
  windowMs: number;
}

export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);
