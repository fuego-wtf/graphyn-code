import fs from 'fs';
import path from 'path';

import { hmacArg, sha256Hex } from './hash.js';
import { vfsPaths } from './paths.js';
import { VfsAction, WorkspaceMount } from './types.js';

export interface ResolvedVirtualPath {
  mount: WorkspaceMount;
  virtualPath: string;
  relativePath: string;
  localPath: string;
  rootRealPath: string;
}

const DEFAULT_CAPABILITIES: VfsAction[] = [
  'ls',
  'cat',
  'grep',
  'snapshot_read',
  'snapshot_create',
];

export function defaultMounts(cwd = process.cwd()): WorkspaceMount[] {
  const paths = vfsPaths();
  return validateMounts([
    makeMount('repo', '/repo', 'local_repo', cwd, DEFAULT_CAPABILITIES),
    makeMount('docs', '/docs', 'local_docs', path.join(cwd, 'docs'), DEFAULT_CAPABILITIES),
    makeMount('receipts', '/receipts', 'local_receipts', paths.receiptsDir, [
      'ls',
      'cat',
      'grep',
      'snapshot_read',
    ]),
  ]);
}

function makeMount(
  id: WorkspaceMount['id'],
  virtualPrefix: WorkspaceMount['virtualPrefix'],
  driverId: WorkspaceMount['driverId'],
  sourceRoot: string,
  capabilities: VfsAction[],
): WorkspaceMount {
  const resolvedRoot = path.resolve(sourceRoot);
  return {
    schemaVersion: 'w235.v1',
    id,
    virtualPrefix,
    driverId,
    sourceRoot: resolvedRoot,
    sourceRootHash: hmacArg(resolvedRoot),
    capabilities,
  };
}

export function normalizeVirtualPath(input: string): string {
  const raw = input.trim();
  if (!raw) throw new Error('virtual path is required');
  if (!raw.startsWith('/')) throw new Error('virtual path must start with /');
  if (raw === '/') throw new Error('root / is not a valid Layer 1 mount path');
  if (raw.includes('\0')) throw new Error('virtual path contains a null byte');
  if (raw.includes('\\')) throw new Error('virtual path cannot contain backslashes');
  if (/%(?:2e|2f|5c)/i.test(raw)) {
    throw new Error('virtual path contains an encoded traversal or separator');
  }

  const parts = raw.split('/').filter(Boolean);
  if (parts.some(part => part === '..')) {
    throw new Error('virtual path cannot contain traversal segments');
  }

  const clean = parts.filter(part => part !== '.').join('/');
  return `/${clean}`;
}

export function validateMounts(mounts: WorkspaceMount[]): WorkspaceMount[] {
  const seen = new Set<string>();
  for (const mount of mounts) {
    const prefix = normalizeVirtualPath(mount.virtualPrefix);
    if (prefix === '/') throw new Error('root / mount is not allowed');
    if (seen.has(prefix)) throw new Error(`duplicate mount prefix: ${prefix}`);
    const conflictingPrefix = [...seen].find(existingPrefix => virtualPrefixesOverlap(existingPrefix, prefix));
    if (conflictingPrefix) {
      throw new Error(`conflicting mount prefixes: ${formatPrefixConflict(conflictingPrefix, prefix)}`);
    }
    seen.add(prefix);
    mount.virtualPrefix = prefix;
    mount.sourceRoot = path.resolve(mount.sourceRoot);
  }
  return mounts;
}

function virtualPrefixesOverlap(left: string, right: string): boolean {
  return left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function formatPrefixConflict(left: string, right: string): string {
  return left.length <= right.length ? `${left} and ${right}` : `${right} and ${left}`;
}

export function resolveVirtualPath(
  virtualPathInput: string,
  mounts = defaultMounts(),
): ResolvedVirtualPath {
  const virtualPath = normalizeVirtualPath(virtualPathInput);
  const mount = mounts
    .filter(candidate => virtualPath === candidate.virtualPrefix || virtualPath.startsWith(`${candidate.virtualPrefix}/`))
    .sort((a, b) => b.virtualPrefix.length - a.virtualPrefix.length)[0];

  if (!mount) throw new Error(`no mount matches ${virtualPath}`);

  const relativePath = virtualPath === mount.virtualPrefix
    ? ''
    : virtualPath.slice(mount.virtualPrefix.length + 1);
  const localPath = path.resolve(mount.sourceRoot, relativePath);
  const rootRealPath = realPathOrResolved(mount.sourceRoot);
  const targetRealPath = existingTargetRealPath(localPath);

  if (targetRealPath && !isInside(rootRealPath, targetRealPath)) {
    throw new Error('resolved path escapes mounted source root');
  }
  if (!targetRealPath && !isInside(rootRealPath, localPath)) {
    throw new Error('resolved path escapes mounted source root');
  }

  return {
    mount,
    virtualPath,
    relativePath,
    localPath,
    rootRealPath,
  };
}

export function isSensitiveVirtualPath(virtualPath: string): boolean {
  const lower = virtualPath.toLowerCase();
  const base = path.posix.basename(lower);
  if (base === '.env' || base.startsWith('.env.')) return true;
  if (base === 'id_rsa' || base === 'id_dsa' || base === 'id_ed25519') return true;
  if (base.endsWith('.pem') || base.endsWith('.key') || base.endsWith('.p12')) return true;
  if (lower.includes('/secrets/') || lower.includes('/.ssh/')) return true;
  return false;
}

export function virtualPathHash(virtualPath: string): string {
  return hmacArg(virtualPath);
}

export function publicContentHash(content: Buffer): string {
  return `sha256:${sha256Hex(content)}`;
}

function realPathOrResolved(candidate: string): string {
  try {
    return fs.realpathSync(candidate);
  } catch {
    return path.resolve(candidate);
  }
}

function existingTargetRealPath(candidate: string): string | null {
  try {
    return fs.realpathSync(candidate);
  } catch {
    return null;
  }
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
