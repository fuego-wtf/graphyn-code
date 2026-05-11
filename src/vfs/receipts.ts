import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

import { hmacArg, sha256Hex } from './hash.js';
import { ensureVfsLayout, vfsPaths } from './paths.js';
import {
  FsGlobalOptions,
  OverallReceiptDecision,
  PromptOutcome,
  QueryClass,
  RuntimeGrant,
  VfsPathOutcome,
  VfsReceipt,
  VfsRedactionEvent,
} from './types.js';

export interface ReceiptInput {
  options: FsGlobalOptions;
  grant: RuntimeGrant | null;
  displayCommandSanitized: string;
  rawArgs: string[];
  queryClass: QueryClass;
  pathOutcomes: VfsPathOutcome[];
  redactionEvents: VfsRedactionEvent[];
  mountIds: string[];
  sourceSystems: string[];
  freshness: 'live' | 'cache' | 'snapshot';
  snapshotId?: string;
  contentHashes: string[];
  status: 'ok' | 'partial' | 'error';
}

export function appendReceipt(input: ReceiptInput): VfsReceipt {
  const paths = vfsPaths();
  ensureVfsLayout(paths);

  const promptOutcome = derivePromptOutcome(input.pathOutcomes);
  return withReceiptLock(paths.receiptsDir, () => {
    const previousReceiptHash = lastReceiptHash(paths.receiptsDir);
    const receiptWithoutHash = {
      schemaVersion: 'w235.v1' as const,
      id: `rcpt_${randomUUID()}`,
      workspaceId: input.options.workspaceId,
      threadId: input.options.threadId,
      runtimeGrantId: input.grant?.id || 'missing',
      actorHash: input.options.subjectHash,
      displayCommandSanitized: input.displayCommandSanitized,
      argHashes: input.rawArgs.map(arg => hmacArg(arg)),
      queryClass: input.queryClass,
      pathOutcomes: input.pathOutcomes,
      redactionEvents: input.redactionEvents,
      mountIds: Array.from(new Set(input.mountIds)).sort(),
      sourceSystems: Array.from(new Set(input.sourceSystems)).sort(),
      overallDecision: deriveOverallDecision(input.pathOutcomes),
      promptOutcome,
      freshness: input.freshness,
      ...(input.snapshotId ? { snapshotId: input.snapshotId } : {}),
      policyHash: input.grant?.policyHash || 'none',
      principalHash: input.options.subjectHash,
      contentHashes: input.contentHashes,
      redactionApplied:
        input.redactionEvents.length > 0 || input.pathOutcomes.some(outcome => outcome.redactionApplied),
      status: input.status,
      timestamp: new Date().toISOString(),
      previousReceiptHash,
    };

    const receiptHash = `sha256:${sha256Hex(JSON.stringify(receiptWithoutHash))}`;
    const receipt: VfsReceipt = {
      ...receiptWithoutHash,
      receiptHash,
    };

    const filePath = path.join(paths.receiptsDir, `${new Date().toISOString().slice(0, 10)}.jsonl`);
    fs.appendFileSync(filePath, `${JSON.stringify(receipt)}\n`, 'utf8');
    return receipt;
  });
}

function deriveOverallDecision(pathOutcomes: VfsPathOutcome[]): OverallReceiptDecision {
  const decisions = new Set(pathOutcomes.map(outcome => outcome.decision));
  if (decisions.size > 1) return 'mixed';
  return pathOutcomes[0]?.decision || 'denied';
}

function derivePromptOutcome(pathOutcomes: VfsPathOutcome[]): PromptOutcome {
  return pathOutcomes.some(outcome => outcome.decision === 'prompted') ? 'declined' : 'not_prompted';
}

function lastReceiptHash(receiptsDir: string): string | null {
  if (!fs.existsSync(receiptsDir)) return null;
  const files = fs.readdirSync(receiptsDir)
    .filter(file => file.endsWith('.jsonl'))
    .sort();
  for (const file of files.reverse()) {
    const filePath = path.join(receiptsDir, file);
    const lines = fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/).filter(Boolean);
    for (const line of lines.reverse()) {
      try {
        const parsed = JSON.parse(line) as { receiptHash?: string };
        if (parsed.receiptHash) return parsed.receiptHash;
      } catch {
        // Ignore malformed historical rows for hash chaining.
      }
    }
  }
  return null;
}

function withReceiptLock<T>(receiptsDir: string, fn: () => T): T {
  const lockDir = path.join(receiptsDir, '.lock');
  const started = Date.now();
  while (true) {
    try {
      fs.mkdirSync(lockDir);
      break;
    } catch {
      if (Date.now() - started > 5000) throw new Error('timed out waiting for receipt lock');
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }

  try {
    return fn();
  } finally {
    fs.rmSync(lockDir, { recursive: true, force: true });
  }
}
