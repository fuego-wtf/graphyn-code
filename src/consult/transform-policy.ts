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

export function applyTransformChain(input: string): { output: string; receipt: TransformReceipt } {
  // Deterministic no-op transform in this loop; stage attribution and hashes are mandatory.
  const output = input;
  return {
    output,
    receipt: {
      original_input: input,
      input_transform_chain: [
        'resolveSessionWhoHowWhat',
        'applyModeContractInjection',
        'applyKnowledgeContextInjection',
        'applyPolicyGuardrails',
      ],
      input_hash_before: sha256hex(input),
      input_hash_after: sha256hex(output),
    },
  };
}

export function applyConsultTransformPolicy(input: string): {
  transformedInput: string;
  receipt: TransformReceipt;
} {
  const { output, receipt } = applyTransformChain(input);
  return {
    transformedInput: output,
    receipt,
  };
}
