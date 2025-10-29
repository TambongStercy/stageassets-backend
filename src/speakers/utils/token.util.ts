import * as crypto from 'crypto';

export function generateAccessToken(length = 64): string {
  return crypto.randomBytes(length / 2).toString('hex');
}
