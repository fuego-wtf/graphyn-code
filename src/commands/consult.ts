import GraphynAPIClient from '../api-client.js';
import type { ConsultDispatchResponse } from '../api-client.js';
import {
  createConsultFailureEnvelope,
  type ConsultCommandResult,
  type ConsultErrorCode,
} from '../consult/contracts.js';
import { applyConsultTransformPolicy } from '../consult/transform-policy.js';

export interface ConsultCommandInput {
  agentUuid: string;
  machine: string;
  question: string;
}

export function emitDeterministicFailureEnvelope(code: ConsultErrorCode): ConsultCommandResult {
  return createConsultFailureEnvelope(code);
}

function classifyDispatchError(message: string): ConsultErrorCode {
  const normalized = message.toLowerCase();
  if (normalized.includes('permission')) return 'PERMISSION_DENIED';
  if (normalized.includes('agent not found')) return 'AGENT_NOT_FOUND';
  if (normalized.includes('machine not found')) return 'MACHINE_NOT_FOUND';
  return 'RUNTIME_UNREACHABLE';
}

export async function runConsultCommand(input: ConsultCommandInput): Promise<ConsultCommandResult> {
  const client = new GraphynAPIClient();
  await client.initialize();

  if (!client.currentToken) {
    return emitDeterministicFailureEnvelope('AUTH_REQUIRED');
  }

  let machine = null;
  try {
    machine = await client.resolveMachineByTag(input.machine);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = message.toLowerCase().includes('permission') ? 'PERMISSION_DENIED' : 'MACHINE_NOT_FOUND';
    return emitDeterministicFailureEnvelope(code);
  }

  if (!machine) {
    return emitDeterministicFailureEnvelope('MACHINE_NOT_FOUND');
  }

  const liveness = await client.getMachineRuntimeStatus(machine.id);
  if (!liveness.connected) {
    return emitDeterministicFailureEnvelope('MACHINE_OFFLINE');
  }

  const transform = applyConsultTransformPolicy(input.question);

  let dispatchResponse: ConsultDispatchResponse;
  try {
    dispatchResponse = await client.dispatchConsult({
      agent_uuid: input.agentUuid,
      machine_id: machine.id,
      machine_tag: input.machine,
      question: input.question,
      transformed_input: transform.transformedInput,
      transform_receipt: transform.receipt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return emitDeterministicFailureEnvelope(classifyDispatchError(message));
  }

  if (!dispatchResponse.ok) {
    return emitDeterministicFailureEnvelope('RUNTIME_UNREACHABLE');
  }

  return {
    ok: true,
    response: dispatchResponse.response ?? '',
    metadata: {
      machine_id: machine.id,
      machine_tag: input.machine,
      transform_receipt: transform.receipt,
      ...(dispatchResponse.metadata ?? {}),
    },
  };
}
