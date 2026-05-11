import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { ensureVfsLayout, vfsPaths } from './paths.js';

export function sha256Hex(value: string | Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function contentHash(content: Buffer): string {
  return `sha256:${sha256Hex(content)}`;
}

export function ensureHmacKey(): Buffer {
  const paths = vfsPaths();
  ensureVfsLayout(paths);
  try {
    const existing = fs.readFileSync(paths.hmacKeyPath);
    if (existing.length >= 32) return existing;
  } catch {
    // Create below.
  }

  const key = crypto.randomBytes(32);
  const tempPath = `${paths.hmacKeyPath}.${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(paths.hmacKeyPath), { recursive: true });
  fs.writeFileSync(tempPath, key, { mode: 0o600 });
  try {
    fs.renameSync(tempPath, paths.hmacKeyPath);
  } catch {
    fs.rmSync(tempPath, { force: true });
  }
  try {
    fs.chmodSync(paths.hmacKeyPath, 0o600);
  } catch {
    // Best-effort on non-POSIX filesystems.
  }
  return fs.readFileSync(paths.hmacKeyPath);
}

export function hmacArg(value: string): string {
  const key = ensureHmacKey();
  return `hmac-sha256:${crypto.createHmac('sha256', key).update(value).digest('hex')}`;
}

