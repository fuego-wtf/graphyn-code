import { createHash } from 'crypto';

export interface TransformReceipt {
  [key: string]: unknown;
  original_input: string;
  input_transform_chain: [
    'resolveSessionWhoHowWhat',
    'applyModeContractInjection',
    'applyKnowledgeContextInjection',
    'applyPolicyGuardrails',
  ];
  input_hash_before: string;
  input_hash_after: string;
}

function sha256hex(input: string): string {
  return createHash('sha256').update(input, 'utf-8').digest('hex');
}

// ─── Secret redaction (W274 guardrail G1) ──────────────────────────────────────
// Strip obvious secret material before any external harness CLI sees the question.
// Proof of redaction is the hash mismatch in the transform receipt.
// Canonical home: this file. harness-adapter.ts imports from here.

const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_\-]{16,}\b/g,                                              // OpenAI-style keys
  /\bAIza[0-9A-Za-z_\-]{30,}\b/g,                                             // Google API keys
  /\bghp_[A-Za-z0-9]{20,}\b/g,                                                // GitHub PATs
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,                                        // Slack tokens
  /\b(?:api[_-]?key|token|secret|password|passwd|bearer)\b\s*[:=]\s*['"]?[^\s'"]{6,}/gi,
];

/**
 * Redact obvious secret material from a string.
 * Each match is replaced with `[REDACTED]`.
 * Returns the cleaned text and a flag indicating whether anything was stripped.
 * Canonical home for W274 G1; harness-adapter.ts re-exports this.
 */
export function redactSecrets(input: string): { text: string; redacted: boolean } {
  let redacted = false;
  let text = input;
  for (const pattern of SECRET_PATTERNS) {
    // Reset lastIndex so repeated calls with the same /g pattern work correctly.
    pattern.lastIndex = 0;
    text = text.replace(pattern, () => {
      redacted = true;
      return '[REDACTED]';
    });
  }
  return { text, redacted };
}

// ─── Stage implementations ────────────────────────────────────────────────────

function resolveSessionWhoHowWhat(text: string): string {
  // Stage 1 — session/WHO/HOW/WHAT injection: Wave 3+, documented passthrough for now.
  return text;
}

function applyModeContractInjection(text: string): string {
  // Stage 2 — mode-contract injection: Wave 3+, documented passthrough for now.
  return text;
}

function applyKnowledgeContextInjection(text: string): string {
  // Stage 3 — KB context injection: Wave 3+, documented passthrough for now.
  return text;
}

function applyPolicyGuardrails(text: string): { output: string; redacted: boolean } {
  // Stage 4 — policy guardrails: redact secrets. This is the active G1 stage.
  // Hash mismatch between input_hash_before and input_hash_after is the
  // machine-verifiable proof that redaction ran.
  const { text: output, redacted } = redactSecrets(text);
  return { output, redacted };
}

// ─── Transform chain ──────────────────────────────────────────────────────────

export function applyTransformChain(input: string): { output: string; receipt: TransformReceipt; redacted: boolean } {
  const rawInput = input;

  // Stages 1-3 are documented passthroughs (Wave 3+ will inject session/mode/KB context).
  let text = resolveSessionWhoHowWhat(rawInput);
  text = applyModeContractInjection(text);
  text = applyKnowledgeContextInjection(text);

  // Stage 4 is the active G1 guardrail: secret redaction.
  const { output, redacted } = applyPolicyGuardrails(text);

  const receipt: TransformReceipt = {
    original_input: rawInput,
    input_transform_chain: [
      'resolveSessionWhoHowWhat',
      'applyModeContractInjection',
      'applyKnowledgeContextInjection',
      'applyPolicyGuardrails',
    ],
    input_hash_before: sha256hex(rawInput),
    input_hash_after: sha256hex(output),
  };

  return { output, receipt, redacted };
}

/**
 * Apply the full consult transform policy to the raw operator question.
 *
 * Returns:
 *   - `transformedInput`: the text to hand to the leaf harness (secrets redacted).
 *   - `receipt`: deterministic SHA-256 before/after + 4-stage attribution.
 *     Hash mismatch (`input_hash_before !== input_hash_after`) is machine-verifiable
 *     proof that stage 4 (applyPolicyGuardrails) stripped at least one secret.
 *   - `redacted`: true iff any secret pattern matched and was replaced.
 */
export function applyConsultTransformPolicy(input: string): {
  transformedInput: string;
  receipt: TransformReceipt;
  redacted: boolean;
} {
  const { output, receipt, redacted } = applyTransformChain(input);
  return {
    transformedInput: output,
    receipt,
    redacted,
  };
}
