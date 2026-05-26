/**
 * HarnessCapabilityAdapter — routes "harness/*" capability-domain requests to
 * the cross-harness A2A consult junction.
 *
 * Domain convention:
 *   harness/gemini  → consult Gemini harness
 *   harness/codex   → consult Codex harness
 *
 * Body contract (req.body):
 *   { question: string; model?: string; from?: string }
 *
 * All safety, secret-stripping, and read-only enforcement live in
 * runHarnessConsult — this adapter is intentionally transport-thin.
 *
 * Design ref: docs/desktop/research/w273-research-cli-a2a-harness-junction/
 *   99-synthesis-and-design.md §3.1 (CapabilityRouter insertion point).
 * W273 L1 §3.1.
 */

import {
  runHarnessConsult,
  SUPPORTED_HARNESSES,
  type HarnessId,
} from '../consult/harness-adapter.js';
import type { BackyardCapabilityRequest, BackyardResult } from './backyard-cli-adapter.js';
import type { CapabilityAdapter } from './capability-router.js';

// ─── Body contract ────────────────────────────────────────────────────────────

interface HarnessConsultBody {
  question: string;
  model?: string;
  from?: string;
}

// ─── Failure helper (mirrors BackyardFailureEnvelope without importing internals) ─

function makeFailure<T>(
  code: 'INVALID_INPUT' | 'NOT_FOUND',
  message: string,
  actionable: string,
): BackyardResult<T> {
  return {
    ok: false,
    error: { code, message, actionable },
    timestamp: new Date().toISOString(),
  };
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class HarnessCapabilityAdapter implements CapabilityAdapter {
  async invoke<T>(req: BackyardCapabilityRequest): Promise<BackyardResult<T>> {
    // ── 1. Parse the target harness from the domain ────────────────────────
    // e.g. "harness/gemini" → "gemini"
    const segments = req.domain.split('/');
    const harnessSegment = segments[1];

    if (!harnessSegment) {
      return makeFailure<T>(
        'INVALID_INPUT',
        'Missing harness identifier in domain — expected "harness/<id>".',
        `Provide a valid domain: harness/${SUPPORTED_HARNESSES.join(' | harness/')}.`,
      );
    }

    if (!(SUPPORTED_HARNESSES as readonly string[]).includes(harnessSegment)) {
      return makeFailure<T>(
        'NOT_FOUND',
        `Harness "${harnessSegment}" is not supported in this build.`,
        `Supported harnesses: ${SUPPORTED_HARNESSES.join(', ')}.`,
      );
    }

    const toHarness = harnessSegment as HarnessId;

    // ── 2. Extract and validate the body ──────────────────────────────────
    const body = req.body as Partial<HarnessConsultBody> | undefined;
    const question = body?.question;

    if (!question || typeof question !== 'string' || !question.trim()) {
      return makeFailure<T>(
        'INVALID_INPUT',
        'Missing or empty "question" field in request body.',
        'Supply a non-empty question: { question: "your question here" }.',
      );
    }

    const model = typeof body?.model === 'string' ? body.model : undefined;
    const fromHarness = typeof body?.from === 'string' ? body.from : undefined;

    // ── 3. Delegate to runHarnessConsult ──────────────────────────────────
    const result = await runHarnessConsult({ toHarness, question, model, fromHarness });

    // ── 4. Map HarnessConsultResult → BackyardResult<T> ───────────────────
    if (result.ok) {
      return {
        ok: true,
        data: {
          response: result.response,
          answeredByModel: result.answeredByModel,
          receipt: result.receipt,
          durationMs: result.durationMs,
        } as unknown as T,
        statusCode: 200,
      };
    }

    // Map harness error codes to the nearest BackyardErrorCode equivalent.
    // BAD_REQUEST / HARNESS_NOT_WIRED → INVALID_INPUT
    // Everything else (timeout, failed, unavailable, unsafe) → BACKEND_UNREACHABLE
    const isInputError =
      result.errorCode === 'BAD_REQUEST' || result.errorCode === 'HARNESS_NOT_WIRED';

    return {
      ok: false,
      error: {
        code: isInputError ? 'INVALID_INPUT' : 'BACKEND_UNREACHABLE',
        message: result.error,
        actionable: result.actionable,
        details: { harnessErrorCode: result.errorCode, toHarness: result.toHarness },
      },
      timestamp: new Date().toISOString(),
    };
  }
}
