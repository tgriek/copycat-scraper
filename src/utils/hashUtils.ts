import crypto from 'node:crypto';

export function sha256(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function md5(data: Buffer | string): string {
  return crypto.createHash('md5').update(data).digest('hex');
}

export function shortHash(data: Buffer | string, length: number = 8): string {
  return sha256(data).slice(0, length);
}
