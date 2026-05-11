import fs from 'fs';
import os from 'os';
import path from 'path';

export interface VfsPaths {
  rootDir: string;
  workspacesDir: string;
  runtimeGrantsDir: string;
  vfsDir: string;
  receiptsDir: string;
  cacheDir: string;
  snapshotsDir: string;
  threadsDir: string;
  hmacKeyPath: string;
}

export function graphynHomeDir(): string {
  const override = process.env.GRAPHYN_HOME?.trim();
  if (override) return path.resolve(override);
  return path.join(os.homedir(), '.graphyn');
}

export function vfsPaths(): VfsPaths {
  const rootDir = graphynHomeDir();
  const vfsDir = path.join(rootDir, 'vfs');
  return {
    rootDir,
    workspacesDir: path.join(rootDir, 'workspaces'),
    runtimeGrantsDir: path.join(rootDir, 'grants', 'runtime'),
    vfsDir,
    receiptsDir: path.join(vfsDir, 'receipts'),
    cacheDir: path.join(vfsDir, 'cache'),
    snapshotsDir: path.join(vfsDir, 'snapshots'),
    threadsDir: path.join(rootDir, 'threads'),
    hmacKeyPath: path.join(vfsDir, 'receipt-hmac.key'),
  };
}

export function ensureVfsLayout(paths = vfsPaths()): void {
  for (const dir of [
    paths.rootDir,
    paths.workspacesDir,
    paths.runtimeGrantsDir,
    paths.vfsDir,
    paths.receiptsDir,
    paths.cacheDir,
    paths.snapshotsDir,
    paths.threadsDir,
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function assertSafeId(value: string, label: string): void {
  if (!/^[A-Za-z0-9._-]+$/.test(value)) {
    throw new Error(`${label} must contain only letters, numbers, dot, underscore, or dash`);
  }
}

export function runtimeGrantPath(grantId: string, paths = vfsPaths()): string {
  assertSafeId(grantId, 'grant id');
  return path.join(paths.runtimeGrantsDir, `${grantId}.json`);
}

export function snapshotManifestPath(snapshotId: string, paths = vfsPaths()): string {
  assertSafeId(snapshotId, 'snapshot id');
  return path.join(paths.snapshotsDir, snapshotId, 'manifest.json');
}

