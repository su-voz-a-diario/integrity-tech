import { Injectable } from '@nestjs/common';
import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';

@Injectable()
export class PasswordService {
  private readonly iterations = 310000;
  private readonly keyLength = 32;
  private readonly digest = 'sha256';

  hashPassword(password: string): string {
    const salt = randomBytes(16).toString('base64url');
    const hash = pbkdf2Sync(password, salt, this.iterations, this.keyLength, this.digest).toString('base64url');
    return `pbkdf2$${this.iterations}$${salt}$${hash}`;
  }

  verifyPassword(password: string, storedHash: string): boolean {
    const [scheme, iterations, salt, hash] = storedHash.split('$');
    if (scheme !== 'pbkdf2' || !iterations || !salt || !hash) {
      return false;
    }

    const expected = Buffer.from(hash, 'base64url');
    const received = pbkdf2Sync(password, salt, Number(iterations), expected.length, this.digest);
    return expected.length === received.length && timingSafeEqual(expected, received);
  }
}
