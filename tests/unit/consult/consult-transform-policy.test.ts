import { describe, expect, it } from 'vitest';
import { applyConsultTransformPolicy } from '../../../src/consult/transform-policy.js';

describe('consult transform policy', () => {
  it('emits receipt with required fields', () => {
    const result = applyConsultTransformPolicy('How do I fix auth race conditions?');

    expect(result.receipt.original_input).toBe('How do I fix auth race conditions?');
    expect(result.receipt.input_transform_chain).toEqual([
      'resolveSessionWhoHowWhat',
      'applyModeContractInjection',
      'applyKnowledgeContextInjection',
      'applyPolicyGuardrails',
    ]);
    expect(result.receipt.input_hash_before).toMatch(/^[a-f0-9]{64}$/);
    expect(result.receipt.input_hash_after).toMatch(/^[a-f0-9]{64}$/);
  });
});
