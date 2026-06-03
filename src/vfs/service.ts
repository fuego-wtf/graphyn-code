import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

import { contentHash, hmacArg } from './hash.js';
import {
  defaultMounts,
  isSensitiveVirtualPath,
  normalizeVirtualPath,
  publicContentHash,
  resolveVirtualPath,
} from './mounts.js';
import { assertSafeId, ensureVfsLayout, snapshotManifestPath } from './paths.js';
import { loadRuntimeGrant, makePathOutcome, evaluatePathPolicy, redactVirtualPath } from './policy.js';
import { appendReceipt } from './receipts.js';
import {
  FsGlobalOptions,
  QueryClass,
  RuntimeGrant,
  VfsEnvelope,
  VfsPathOutcome,
  VfsRedactionEvent,
  VfsSnapshot,
  WorkspaceMount,
} from './types.js';

interface CommandResult {
  envelope: VfsEnvelope;
  exitCode: number;
}

interface CommandContext {
  options: FsGlobalOptions;
  grant: RuntimeGrant | null;
  grantMissingReason?: string;
  mounts: WorkspaceMount[];
  rawArgs: string[];
}

interface GrepMatch {
  path: string;
  line: number;
  text: string;
}

const MAX_CAT_BYTES = 1024 * 1024;
const MAX_GREP_FILE_BYTES = 512 * 1024;
const MAX_SNAPSHOT_FILES = 500;

export async function executeFsCommand(args: string[], options: FsGlobalOptions): Promise<CommandResult> {
  ensureVfsLayout();
  const loadedGrant = loadRuntimeGrant(options);
  const ctx: CommandContext = {
    options,
    grant: loadedGrant.grant,
    grantMissingReason: loadedGrant.reasonCode,
    mounts: defaultMounts(),
    rawArgs: args,
  };

  const [command, ...rest] = args;
  try {
    if (!command || command === 'help' || command === '--help' || command === '-h') {
      return helpResult(ctx);
    }
    if (command === 'ls' || command === 'list') return runLs(ctx, rest);
    if (command === 'cat') return runCat(ctx, rest);
    if (command === 'grep') return runGrep(ctx, rest);
    if (command === 'snapshot') return runSnapshot(ctx, rest);
    return unsupportedResult(ctx, command);
  } catch (error) {
    return errorResult(ctx, error instanceof Error ? error.message : String(error));
  }
}

function runLs(ctx: CommandContext, args: string[]): CommandResult {
  const target = args[0] || '/';
  if (target === '/') {
    const outcomes = ctx.mounts.map(mount => {
      const policy = evaluatePathPolicy(ctx.grant, ctx.grantMissingReason, mount, 'ls', mount.virtualPrefix);
      return makePathOutcome(mount.virtualPrefix, 'ls', policy);
    });
    const allowedMounts = ctx.mounts.filter((_mount, index) => outcomes[index]?.decision === 'allowed');
    const allowed = outcomes.some(outcome => outcome.decision === 'allowed');
    const denied = outcomes.some(outcome => outcome.decision !== 'allowed');
    const status = denied && allowed ? 'partial' : denied ? 'denied' : 'ok';
    return receiptResult(ctx, {
      displayCommandSanitized: 'graphyn fs ls /',
      queryClass: 'path',
      outcomes,
      redactionEvents: [],
      mountIds: ctx.mounts.map(mount => mount.id),
      contentHashes: [],
      data: {
        entries: allowedMounts.map(mount => ({
          name: mount.virtualPrefix.slice(1),
          path: mount.virtualPrefix,
          kind: 'mount',
          driverId: mount.driverId,
        })),
      },
      status,
      exitCode: status === 'ok' ? 0 : status === 'partial' ? 2 : 3,
    });
  }

  const resolved = resolveVirtualPath(target, ctx.mounts);
  const policy = evaluatePathPolicy(ctx.grant, ctx.grantMissingReason, resolved.mount, 'ls', resolved.virtualPath);
  const denied = policy.receiptDecision !== 'allowed';
  const outcome = makePathOutcome(resolved.virtualPath, 'ls', policy);
  if (denied) {
    return receiptResult(ctx, deniedPayload('graphyn fs ls', [resolved.virtualPath], 'path', [outcome], [resolved.mount.id]));
  }

  if (!fs.existsSync(resolved.localPath)) {
    outcome.decision = 'denied';
    outcome.reasonCode = 'not_found';
    return receiptResult(ctx, notFoundPayload('graphyn fs ls', [resolved.virtualPath], 'path', [outcome], [resolved.mount.id]));
  }
  const stat = fs.statSync(resolved.localPath);
  if (!stat.isDirectory()) {
    outcome.decision = 'denied';
    outcome.reasonCode = 'not_directory';
    return receiptResult(ctx, errorPayload('graphyn fs ls', [resolved.virtualPath], 'path', [outcome], [resolved.mount.id], 'NOT_DIRECTORY', 'path is not a directory', 4));
  }

  const entries = fs.readdirSync(resolved.localPath, { withFileTypes: true }).map(entry => ({
    name: entry.name,
    path: `${resolved.virtualPath === '/' ? '' : resolved.virtualPath}/${entry.name}`,
    kind: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other',
  }));
  return receiptResult(ctx, {
    displayCommandSanitized: `graphyn fs ls ${resolved.virtualPath}`,
    queryClass: 'path',
    outcomes: [outcome],
    redactionEvents: [],
    mountIds: [resolved.mount.id],
    contentHashes: [],
    data: { entries },
    status: 'ok',
    exitCode: 0,
  });
}

function runCat(ctx: CommandContext, args: string[]): CommandResult {
  const target = args[0];
  if (!target) throw new Error('cat requires a virtual path');

  const resolved = resolveVirtualPath(target, ctx.mounts);
  const policy = evaluatePathPolicy(ctx.grant, ctx.grantMissingReason, resolved.mount, 'cat', resolved.virtualPath);
  const sanitizedPath = policy.redactionApplied ? redactVirtualPath(resolved.virtualPath) : resolved.virtualPath;
  const redactionEvents = policy.redactionApplied ? [redaction('virtualPath', 'sensitive_path')] : [];
  if (policy.receiptDecision !== 'allowed') {
    return receiptResult(ctx, deniedPayload('graphyn fs cat', [sanitizedPath], 'path', [
      makePathOutcome(resolved.virtualPath, 'cat', policy),
    ], [resolved.mount.id], redactionEvents));
  }

  if (!fs.existsSync(resolved.localPath)) {
    return receiptResult(ctx, notFoundPayload('graphyn fs cat', [resolved.virtualPath], 'path', [
      makePathOutcome(resolved.virtualPath, 'cat', { ...policy, receiptDecision: 'denied', reasonCode: 'not_found' }),
    ], [resolved.mount.id]));
  }
  const stat = fs.statSync(resolved.localPath);
  if (!stat.isFile()) {
    return receiptResult(ctx, errorPayload('graphyn fs cat', [resolved.virtualPath], 'path', [
      makePathOutcome(resolved.virtualPath, 'cat', { ...policy, receiptDecision: 'denied', reasonCode: 'not_file' }),
    ], [resolved.mount.id], 'NOT_FILE', 'path is not a file', 4));
  }
  if (stat.size > MAX_CAT_BYTES) {
    return receiptResult(ctx, errorPayload('graphyn fs cat', [resolved.virtualPath], 'path', [
      makePathOutcome(resolved.virtualPath, 'cat', { ...policy, receiptDecision: 'denied', reasonCode: 'file_too_large' }),
    ], [resolved.mount.id], 'FILE_TOO_LARGE', 'file exceeds Layer 1 cat size limit', 4));
  }

  const content = fs.readFileSync(resolved.localPath);
  const hash = contentHash(content);
  const outcome = makePathOutcome(resolved.virtualPath, 'cat', policy, hash);
  return receiptResult(ctx, {
    displayCommandSanitized: `graphyn fs cat ${resolved.virtualPath}`,
    queryClass: 'path',
    outcomes: [outcome],
    redactionEvents: [],
    mountIds: [resolved.mount.id],
    contentHashes: [hash],
    data: {
      path: resolved.virtualPath,
      content: content.toString('utf8'),
      contentHash: hash,
    },
    status: 'ok',
    exitCode: 0,
  });
}

function runGrep(ctx: CommandContext, args: string[]): CommandResult {
  const parsed = parseGrepArgs(args);
  if (!parsed.query) throw new Error('grep requires a query');
  if (parsed.paths.length === 0) throw new Error('grep requires at least one virtual path');

  const matches: GrepMatch[] = [];
  const outcomes: VfsPathOutcome[] = [];
  const mountIds: string[] = [];
  const contentHashes: string[] = [];
  const redactionEvents: VfsRedactionEvent[] = [redaction('args', 'grep_query_redacted', parsed.query)];
  const regex = parsed.regex ? new RegExp(parsed.query) : null;

  for (const target of parsed.paths) {
    const resolved = resolveVirtualPath(target, ctx.mounts);
    mountIds.push(resolved.mount.id);
    const policy = evaluatePathPolicy(ctx.grant, ctx.grantMissingReason, resolved.mount, 'grep', resolved.virtualPath);
    if (policy.receiptDecision !== 'allowed') {
      outcomes.push(makePathOutcome(resolved.virtualPath, 'grep', policy));
      continue;
    }
    if (!fs.existsSync(resolved.localPath)) {
      outcomes.push(makePathOutcome(resolved.virtualPath, 'grep', { ...policy, receiptDecision: 'denied', reasonCode: 'not_found' }));
      continue;
    }

    const files = collectFiles(resolved.localPath, resolved.virtualPath);
    let pathHadReadableContent = false;
    for (const file of files) {
      const filePolicy = evaluatePathPolicy(
        ctx.grant,
        ctx.grantMissingReason,
        resolved.mount,
        'grep',
        file.virtualPath,
      );
      if (filePolicy.receiptDecision !== 'allowed') {
        outcomes.push(makePathOutcome(file.virtualPath, 'grep', filePolicy));
        if (filePolicy.redactionApplied) {
          redactionEvents.push(redaction('virtualPath', 'sensitive_path', file.virtualPath));
        }
        continue;
      }
      const stat = fs.statSync(file.localPath);
      if (stat.size > MAX_GREP_FILE_BYTES) continue;
      const buf = fs.readFileSync(file.localPath);
      if (looksBinary(buf)) continue;
      const hash = contentHash(buf);
      contentHashes.push(hash);
      pathHadReadableContent = true;
      const lines = buf.toString('utf8').split(/\r?\n/);
      lines.forEach((line, index) => {
        const found = regex ? regex.test(line) : line.includes(parsed.query);
        if (found) matches.push({ path: file.virtualPath, line: index + 1, text: line });
      });
    }
    outcomes.push(makePathOutcome(resolved.virtualPath, 'grep', {
      ...policy,
      reasonCode: pathHadReadableContent ? 'runtime_grant_allowed' : 'no_readable_files',
    }));
  }

  const allowed = outcomes.some(outcome => outcome.decision === 'allowed');
  const denied = outcomes.some(outcome => outcome.decision !== 'allowed');
  const status = denied && allowed ? 'partial' : denied ? 'denied' : matches.length === 0 ? 'no_match' : 'ok';
  return receiptResult(ctx, {
    displayCommandSanitized: `graphyn fs grep [${parsed.regex ? 'regex' : 'literal'}] ${parsed.paths.map(sanitizeDisplayPath).join(' ')}`,
    queryClass: parsed.regex ? 'regex' : 'literal',
    outcomes,
    redactionEvents,
    mountIds,
    contentHashes,
    data: { matches },
    status,
    exitCode: status === 'ok' ? 0 : status === 'partial' ? 2 : status === 'no_match' ? 1 : 3,
  });
}

function runSnapshot(ctx: CommandContext, args: string[]): CommandResult {
  const [subcommand, ...rest] = args;
  if (subcommand === 'create') return runSnapshotCreate(ctx, rest);
  if (subcommand === 'read') return runSnapshotRead(ctx, rest);
  return unsupportedResult(ctx, `snapshot ${subcommand || ''}`.trim());
}

function runSnapshotCreate(ctx: CommandContext, args: string[]): CommandResult {
  const parsed = parseSnapshotCreateArgs(args);
  const sourcePaths = parsed.paths.length > 0 ? parsed.paths : ['/repo', '/docs', '/receipts'];
  const outcomes: VfsPathOutcome[] = [];
  const mountIds: string[] = [];
  const contentHashes: string[] = [];
  const sourcePathHashes: string[] = [];
  const redactionEvents: VfsRedactionEvent[] = [];
  const manifestSourcePaths: string[] = [];

  for (const sourcePath of sourcePaths) {
    const resolved = resolveVirtualPath(sourcePath, ctx.mounts);
    mountIds.push(resolved.mount.id);
    const policy = evaluatePathPolicy(ctx.grant, ctx.grantMissingReason, resolved.mount, 'snapshot_create', resolved.virtualPath);
    outcomes.push(makePathOutcome(resolved.virtualPath, 'snapshot_create', policy));
    if (policy.receiptDecision !== 'allowed') continue;

    manifestSourcePaths.push(resolved.virtualPath);
    sourcePathHashes.push(hmacArg(resolved.virtualPath));
    if (!fs.existsSync(resolved.localPath)) continue;
    for (const file of collectFiles(resolved.localPath, resolved.virtualPath).slice(0, MAX_SNAPSHOT_FILES)) {
      const filePolicy = evaluatePathPolicy(
        ctx.grant,
        ctx.grantMissingReason,
        resolved.mount,
        'snapshot_create',
        file.virtualPath,
      );
      if (filePolicy.receiptDecision !== 'allowed') {
        outcomes.push(makePathOutcome(file.virtualPath, 'snapshot_create', filePolicy));
        if (filePolicy.redactionApplied) {
          redactionEvents.push(redaction('content', 'sensitive_path', file.virtualPath));
        }
        continue;
      }
      const stat = fs.statSync(file.localPath);
      if (stat.size > MAX_GREP_FILE_BYTES) continue;
      contentHashes.push(publicContentHash(fs.readFileSync(file.localPath)));
    }
  }

  const allowed = outcomes.some(outcome => outcome.decision === 'allowed');
  const denied = outcomes.some(outcome => outcome.decision !== 'allowed');
  const status = denied && allowed ? 'partial' : denied ? 'denied' : 'ok';
  let snapshotId: string | undefined;
  let manifest: VfsSnapshot | undefined;
  if (allowed) {
    snapshotId = `snap_${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}_${randomUUID().slice(0, 8)}`;
    manifest = {
      schemaVersion: 'w235.v1',
      id: snapshotId,
      workspaceId: ctx.options.workspaceId,
      threadId: ctx.options.threadId,
      runtimeGrantId: ctx.grant?.id || 'missing',
      actorHash: ctx.options.subjectHash,
      policyHash: ctx.grant?.policyHash || 'none',
      sourcePaths: manifestSourcePaths,
      sourcePathHashes,
      contentHashes: Array.from(new Set(contentHashes)).sort(),
      redactionApplied: redactionEvents.length > 0,
      redactionEvents,
      freshness: 'snapshot',
      createdAt: new Date().toISOString(),
    };
    writeSnapshotManifest(snapshotId, manifest);
  }

  return receiptResult(ctx, {
    displayCommandSanitized: `graphyn fs snapshot create --name ${parsed.name ? '[name]' : '[default]'} ${sourcePaths.map(sanitizeDisplayPath).join(' ')}`.trim(),
    queryClass: 'path',
    outcomes,
    redactionEvents,
    mountIds,
    contentHashes: Array.from(new Set(contentHashes)).sort(),
    data: manifest ? { snapshot: manifest } : undefined,
    status,
    exitCode: status === 'ok' ? 0 : status === 'partial' ? 2 : 3,
    snapshotId,
    freshness: 'snapshot',
  });
}

function runSnapshotRead(ctx: CommandContext, args: string[]): CommandResult {
  const snapshotId = args[0];
  if (!snapshotId) throw new Error('snapshot read requires a snapshot id');
  assertSafeId(snapshotId, 'snapshot id');

  const pseudoPath = `/receipts/snapshots/${snapshotId}/manifest.json`;
  const receiptsMount = ctx.mounts.find(mount => mount.id === 'receipts') || ctx.mounts[0];
  const policy = evaluatePathPolicy(ctx.grant, ctx.grantMissingReason, receiptsMount, 'snapshot_read', pseudoPath);
  const outcome = makePathOutcome(pseudoPath, 'snapshot_read', policy);
  if (policy.receiptDecision !== 'allowed') {
    return receiptResult(ctx, deniedPayload('graphyn fs snapshot read', ['[snapshot_id]'], 'path', [outcome], [receiptsMount.id]));
  }

  const manifestPath = snapshotManifestPath(snapshotId);
  if (!fs.existsSync(manifestPath)) {
    outcome.decision = 'denied';
    outcome.reasonCode = 'snapshot_not_found';
    return receiptResult(ctx, notFoundPayload('graphyn fs snapshot read', ['[snapshot_id]'], 'path', [outcome], [receiptsMount.id]));
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as VfsSnapshot;
  return receiptResult(ctx, {
    displayCommandSanitized: 'graphyn fs snapshot read [snapshot_id]',
    queryClass: 'path',
    outcomes: [outcome],
    redactionEvents: [],
    mountIds: [receiptsMount.id],
    contentHashes: manifest.contentHashes,
    data: { snapshot: manifest },
    status: 'ok',
    exitCode: 0,
    snapshotId,
    freshness: 'snapshot',
  });
}

function unsupportedResult(ctx: CommandContext, command: string): CommandResult {
  const outcome: VfsPathOutcome = {
    schemaVersion: 'w235.v1',
    virtualPath: '/[unsupported]',
    virtualPathHash: hmacArg(command),
    action: 'cat',
    decision: 'denied',
    reasonCode: 'unsupported_layer1_command',
    redactionApplied: true,
  };
  return receiptResult(ctx, errorPayload('graphyn fs [unsupported]', [], 'unknown', [outcome], [], 'UNSUPPORTED_COMMAND', 'unsupported Layer 1 fs command', 3, [
    redaction('args', 'unsupported_command_redacted', command),
  ]));
}

function helpResult(ctx: CommandContext): CommandResult {
  const helpMount = ctx.mounts[0];
  const policy = helpMount
    ? evaluatePathPolicy(ctx.grant, ctx.grantMissingReason, helpMount, 'ls', helpMount.virtualPrefix)
    : {
      effect: 'deny' as const,
      receiptDecision: 'denied' as const,
      reasonCode: 'missing_runtime_grant',
      redactionApplied: false,
    };
  const outcome: VfsPathOutcome = {
    schemaVersion: 'w235.v1',
    virtualPath: '/[help]',
    virtualPathHash: hmacArg('help'),
    action: 'ls',
    decision: policy.receiptDecision,
    reasonCode: policy.receiptDecision === 'allowed' ? 'help' : policy.reasonCode,
    redactionApplied: false,
  };
  const allowed = policy.receiptDecision === 'allowed';
  return receiptResult(ctx, {
    displayCommandSanitized: 'graphyn fs help',
    queryClass: 'none',
    outcomes: [outcome],
    redactionEvents: [],
    mountIds: [],
    contentHashes: [],
    data: {
      usage: [
        'graphyn fs ls /repo',
        'graphyn fs cat /repo/README.md',
        'graphyn fs grep "text" /docs /repo',
        'graphyn fs snapshot create --name local-audit-start /repo /docs',
        'graphyn fs snapshot read <snapshot_id>',
      ],
      grant: 'Set GRAPHYN_VFS_GRANT_ID or pass --grant-id <id>. Grants live under ~/.graphyn/grants/runtime/<id>.json.',
    },
    status: allowed ? 'ok' : 'denied',
    exitCode: allowed ? 0 : 3,
  });
}

function receiptResult(ctx: CommandContext, payload: {
  displayCommandSanitized: string;
  queryClass: QueryClass;
  outcomes: VfsPathOutcome[];
  redactionEvents: VfsRedactionEvent[];
  mountIds: string[];
  contentHashes: string[];
  data?: unknown;
  status: VfsEnvelope['status'];
  exitCode: number;
  snapshotId?: string;
  freshness?: 'live' | 'cache' | 'snapshot';
}): CommandResult {
  const receipt = appendReceipt({
    options: ctx.options,
    grant: ctx.grant,
    displayCommandSanitized: payload.displayCommandSanitized,
    rawArgs: ctx.rawArgs,
    queryClass: payload.queryClass,
    pathOutcomes: payload.outcomes,
    redactionEvents: payload.redactionEvents,
    mountIds: payload.mountIds,
    sourceSystems: payload.mountIds.map(id => `local:${id}`),
    freshness: payload.freshness || 'live',
    snapshotId: payload.snapshotId,
    contentHashes: payload.contentHashes,
    status: payload.status === 'ok' || payload.status === 'no_match' ? 'ok' : payload.status === 'partial' ? 'partial' : 'error',
  });
  return {
    exitCode: payload.exitCode,
    envelope: {
      status: payload.status,
      receiptId: receipt.id,
      ...(payload.data ? { data: payload.data } : {}),
      pathOutcomes: payload.outcomes,
      ...(payload.status === 'denied' || payload.status === 'error' || payload.status === 'not_found'
        ? { error: { code: payload.outcomes[0]?.reasonCode || 'ERROR', message: statusMessage(payload.status) } }
        : {}),
    },
  };
}

function deniedPayload(
  command: string,
  sanitizedArgs: string[],
  queryClass: QueryClass,
  outcomes: VfsPathOutcome[],
  mountIds: string[],
  redactionEvents: VfsRedactionEvent[] = [],
) {
  return {
    displayCommandSanitized: `${command} ${sanitizedArgs.join(' ')}`.trim(),
    queryClass,
    outcomes,
    redactionEvents,
    mountIds,
    contentHashes: [],
    status: 'denied' as const,
    exitCode: 3,
  };
}

function notFoundPayload(
  command: string,
  sanitizedArgs: string[],
  queryClass: QueryClass,
  outcomes: VfsPathOutcome[],
  mountIds: string[],
) {
  return {
    displayCommandSanitized: `${command} ${sanitizedArgs.join(' ')}`.trim(),
    queryClass,
    outcomes,
    redactionEvents: [],
    mountIds,
    contentHashes: [],
    status: 'not_found' as const,
    exitCode: 4,
  };
}

function errorPayload(
  command: string,
  sanitizedArgs: string[],
  queryClass: QueryClass,
  outcomes: VfsPathOutcome[],
  mountIds: string[],
  code: string,
  message: string,
  exitCode: number,
  redactionEvents: VfsRedactionEvent[] = [],
) {
  outcomes[0] = outcomes[0] || {
    schemaVersion: 'w235.v1',
    virtualPath: '/[error]',
    virtualPathHash: hmacArg(`${code}:${message}`),
    action: 'cat',
    decision: 'denied',
    reasonCode: code,
    redactionApplied: true,
  };
  return {
    displayCommandSanitized: `${command} ${sanitizedArgs.join(' ')}`.trim(),
    queryClass,
    outcomes,
    redactionEvents,
    mountIds,
    contentHashes: [],
    status: 'error' as const,
    exitCode,
    data: { code, message },
  };
}

function errorResult(ctx: CommandContext, message: string): CommandResult {
  const outcome: VfsPathOutcome = {
    schemaVersion: 'w235.v1',
    virtualPath: '/[error]',
    virtualPathHash: hmacArg(message),
    action: 'cat',
    decision: 'denied',
    reasonCode: 'command_error',
    redactionApplied: true,
  };
  return receiptResult(ctx, errorPayload('graphyn fs [error]', [], 'unknown', [outcome], [], 'COMMAND_ERROR', message, 10, [
    redaction('metadata', 'error_message_redacted', message),
  ]));
}

function parseGrepArgs(args: string[]): { query: string; paths: string[]; regex: boolean } {
  let regex = false;
  const rest: string[] = [];
  for (const arg of args) {
    if (arg === '--regex') regex = true;
    else rest.push(arg);
  }
  const [query, ...paths] = rest;
  return { query, paths, regex };
}

function parseSnapshotCreateArgs(args: string[]): { name?: string; paths: string[] } {
  const paths: string[] = [];
  let name: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name') {
      name = args[i + 1];
      i += 1;
    } else {
      paths.push(args[i]);
    }
  }
  return { name, paths };
}

function collectFiles(localPath: string, virtualPath: string): Array<{ localPath: string; virtualPath: string }> {
  if (!fs.existsSync(localPath)) return [];
  const stat = fs.statSync(localPath);
  if (stat.isFile()) return [{ localPath, virtualPath }];
  if (!stat.isDirectory()) return [];

  const entries: Array<{ localPath: string; virtualPath: string }> = [];
  const ignored = new Set(['.git', 'node_modules', 'target', 'dist', '.next', '.turbo']);
  const stack = [{ localPath, virtualPath }];
  while (stack.length > 0 && entries.length < MAX_SNAPSHOT_FILES) {
    const current = stack.pop();
    if (!current) break;
    for (const dirent of fs.readdirSync(current.localPath, { withFileTypes: true })) {
      if (ignored.has(dirent.name)) continue;
      const childLocal = path.join(current.localPath, dirent.name);
      const childVirtual = `${current.virtualPath}/${dirent.name}`;
      if (dirent.isDirectory()) stack.push({ localPath: childLocal, virtualPath: childVirtual });
      else if (dirent.isFile()) entries.push({ localPath: childLocal, virtualPath: childVirtual });
    }
  }
  return entries;
}

function writeSnapshotManifest(snapshotId: string, manifest: VfsSnapshot): void {
  const manifestPath = snapshotManifestPath(snapshotId);
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  const tempPath = `${manifestPath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(manifest, null, 2), 'utf8');
  fs.renameSync(tempPath, manifestPath);
}

function looksBinary(buffer: Buffer): boolean {
  const length = Math.min(buffer.length, 8000);
  for (let i = 0; i < length; i++) {
    const byte = buffer[i];
    if (byte === 0) return true;
  }
  return false;
}

function redaction(field: VfsRedactionEvent['field'], reasonCode: string, value?: string): VfsRedactionEvent {
  return {
    schemaVersion: 'w235.v1',
    field,
    reasonCode,
    ...(value ? { hash: hmacArg(value) } : {}),
  };
}

function sanitizeDisplayPath(value: string): string {
  try {
    const normalized = normalizeVirtualPath(value);
    return isSensitiveVirtualPath(normalized) ? redactVirtualPath(normalized) : normalized;
  } catch {
    return '[invalid-path]';
  }
}

function statusMessage(status: VfsEnvelope['status']): string {
  if (status === 'denied') return 'command denied by Layer 1 RuntimeGrant policy';
  if (status === 'not_found') return 'virtual path not found';
  if (status === 'error') return 'command failed';
  return status;
}
