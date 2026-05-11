import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const PACKAGE_VERSION = readPackageVersion();

export function readPackageVersion(): string {
  const packageJsonPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'package.json',
  );

  try {
    const raw = fs.readFileSync(packageJsonPath, 'utf8');
    const parsed = JSON.parse(raw) as { version?: unknown };

    if (typeof parsed.version === 'string' && parsed.version.trim()) {
      return parsed.version;
    }
  } catch {
    // Keep deterministic commands usable even if package metadata is unavailable.
  }

  return '0.0.0';
}

export function graphynUserAgent(): string {
  return `Graphyn Code CLI v${PACKAGE_VERSION}`;
}
