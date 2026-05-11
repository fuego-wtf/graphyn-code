import fs from 'fs';

import { hmacArg } from './hash.js';
import { runtimeGrantPath, vfsPaths } from './paths.js';
import {
  AclEffect,
  FsGlobalOptions,
  ReceiptDecision,
  RuntimeGrant,
  VfsAction,
  VfsPathOutcome,
  WorkspaceMount,
} from './types.js';
import { isSensitiveVirtualPath, virtualPathHash } from './mounts.js';

export interface PolicyDecision {
  effect: AclEffect;
  receiptDecision: ReceiptDecision;
  reasonCode: string;
  redactionApplied: boolean;
}

export interface LoadedGrant {
  grant: RuntimeGrant | null;
  reasonCode?: string;
}

const VALID_ACTIONS = new Set<VfsAction>([
  'ls',
  'cat',
  'grep',
  'snapshot_read',
  'snapshot_create',
]);

export function loadRuntimeGrant(options: FsGlobalOptions): LoadedGrant {
  const grantId = options.grantId || process.env.GRAPHYN_VFS_GRANT_ID;
  if (!grantId) {
    return { grant: null, reasonCode: 'missing_runtime_grant' };
  }

  try {
    const raw = fs.readFileSync(runtimeGrantPath(grantId, vfsPaths()), 'utf8');
    const parsed = JSON.parse(raw) as RuntimeGrant;
    const invalid = validateRuntimeGrant(parsed, options);
    if (invalid) return { grant: null, reasonCode: invalid };
    return { grant: parsed };
  } catch (error) {
    return {
      grant: null,
      reasonCode: error instanceof SyntaxError ? 'invalid_runtime_grant_json' : 'runtime_grant_not_found',
    };
  }
}

export function validateRuntimeGrant(grant: RuntimeGrant, options: FsGlobalOptions): string | null {
  if (grant.schemaVersion !== 'w235.v1') return 'invalid_runtime_grant_schema';
  if (!grant.id || typeof grant.id !== 'string') return 'invalid_runtime_grant_id';
  if (grant.workspaceId !== options.workspaceId) return 'workspace_mismatch';
  if (grant.threadId !== options.threadId) return 'thread_mismatch';
  if (grant.sessionId !== options.sessionId) return 'session_mismatch';
  if (grant.agentId !== options.agentId) return 'agent_mismatch';
  if (grant.subjectHash !== options.subjectHash) return 'subject_mismatch';
  if (grant.revokedAt) return 'runtime_grant_revoked';

  const now = Date.now();
  const expires = Date.parse(grant.expiresAt);
  if (!Number.isFinite(expires) || expires <= now) return 'runtime_grant_expired';

  if (!grant.effectiveMatrix || typeof grant.effectiveMatrix !== 'object') {
    return 'invalid_effective_matrix';
  }

  for (const [key, effect] of Object.entries(grant.effectiveMatrix)) {
    const parsed = parseEffectiveKey(key);
    if (!parsed || !VALID_ACTIONS.has(parsed.action)) return 'invalid_effective_matrix_key';
    if (!['allow', 'ask', 'deny'].includes(effect)) return 'invalid_effective_matrix_effect';
  }

  return null;
}

export function evaluatePathPolicy(
  grant: RuntimeGrant | null,
  grantMissingReason: string | undefined,
  mount: WorkspaceMount,
  action: VfsAction,
  virtualPath: string,
): PolicyDecision {
  if (isSensitiveVirtualPath(virtualPath)) {
    return {
      effect: 'deny',
      receiptDecision: 'denied',
      reasonCode: 'sensitive_path_denied',
      redactionApplied: true,
    };
  }

  if (!mount.capabilities.includes(action)) {
    return {
      effect: 'deny',
      receiptDecision: 'denied',
      reasonCode: 'driver_capability_denied',
      redactionApplied: false,
    };
  }

  if (!grant) {
    return {
      effect: 'deny',
      receiptDecision: 'denied',
      reasonCode: grantMissingReason || 'missing_runtime_grant',
      redactionApplied: false,
    };
  }

  if (!grant.capabilityHandles.includes(mountBindingHandle(mount))) {
    return {
      effect: 'deny',
      receiptDecision: 'denied',
      reasonCode: 'mount_binding_missing',
      redactionApplied: false,
    };
  }

  const effect = effectiveDecision(grant, mount.id, action, virtualPath);
  if (effect === 'allow') {
    return {
      effect,
      receiptDecision: 'allowed',
      reasonCode: 'runtime_grant_allowed',
      redactionApplied: false,
    };
  }
  if (effect === 'deny') {
    return {
      effect,
      receiptDecision: 'denied',
      reasonCode: 'runtime_grant_denied',
      redactionApplied: false,
    };
  }
  return {
    effect,
    receiptDecision: 'prompted',
    reasonCode: 'prompt_required_non_interactive',
    redactionApplied: false,
  };
}

export function makePathOutcome(
  virtualPath: string,
  action: VfsAction,
  decision: PolicyDecision,
  contentHash?: string,
): VfsPathOutcome {
  return {
    schemaVersion: 'w235.v1',
    virtualPath: decision.redactionApplied ? redactVirtualPath(virtualPath) : virtualPath,
    virtualPathHash: virtualPathHash(virtualPath),
    action,
    decision: decision.receiptDecision,
    reasonCode: decision.reasonCode,
    ...(contentHash ? { contentHash } : {}),
    redactionApplied: decision.redactionApplied,
  };
}

export function effectiveDecision(
  grant: RuntimeGrant,
  mountId: string,
  action: VfsAction,
  virtualPath: string,
): AclEffect {
  let best: { effect: AclEffect; specificity: number } | null = null;
  for (const [key, effect] of Object.entries(grant.effectiveMatrix)) {
    const parsed = parseEffectiveKey(key);
    if (!parsed) continue;
    if (parsed.mountId !== mountId || parsed.action !== action) continue;
    if (!globMatches(parsed.pathGlob, virtualPath)) continue;
    const specificity = parsed.pathGlob.replace(/\*/g, '').length;
    if (
      !best ||
      rank(effect) > rank(best.effect) ||
      (rank(effect) === rank(best.effect) && specificity > best.specificity)
    ) {
      best = { effect, specificity };
    }
  }
  return best?.effect || 'ask';
}

export function redactVirtualPath(virtualPath: string): string {
  const parts = virtualPath.split('/');
  if (parts.length <= 2) return '/[redacted]';
  return `${parts.slice(0, -1).join('/')}/[redacted]`;
}

export function parseEffectiveKey(key: string): { mountId: string; action: VfsAction; pathGlob: string } | null {
  const first = key.indexOf(':');
  const second = first >= 0 ? key.indexOf(':', first + 1) : -1;
  if (first <= 0 || second <= first + 1 || second === key.length - 1) return null;
  const mountId = key.slice(0, first);
  const action = key.slice(first + 1, second) as VfsAction;
  const pathGlob = key.slice(second + 1);
  if (!/^[A-Za-z0-9._-]+$/.test(mountId)) return null;
  return { mountId, action, pathGlob };
}

function globMatches(glob: string, virtualPath: string): boolean {
  const candidate = glob.startsWith('/') ? virtualPath : stripMountPrefix(virtualPath);
  if (glob === '**' || glob === '*') return true;
  return new RegExp(`^${globToRegExpSource(glob)}$`).test(candidate);
}

function globToRegExpSource(glob: string): string {
  let source = '';
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    const next = glob[index + 1];
    if (char === '*' && next === '*') {
      source += '.*';
      index += 1;
      continue;
    }
    if (char === '*') {
      source += '[^/]*';
      continue;
    }
    source += escapeRegExpChar(char);
  }
  return source;
}

function escapeRegExpChar(char: string): string {
  return /[.+^${}()|[\]\\]/.test(char) ? `\\${char}` : char;
}

function stripMountPrefix(virtualPath: string): string {
  const parts = virtualPath.split('/').filter(Boolean);
  return parts.slice(1).join('/') || '';
}

function rank(effect: AclEffect): number {
  if (effect === 'deny') return 3;
  if (effect === 'ask') return 2;
  return 1;
}

export function subjectHashFromInput(value: string): string {
  return value.startsWith('hmac-sha256:') ? value : hmacArg(value);
}

export function mountBindingHandle(mount: WorkspaceMount): string {
  return `mount:${mount.id}:${mount.sourceRootHash}`;
}
