/**
 * Consult error contracts — deterministic failure envelope mapper.
 */

export type ConsultErrorCode =
  | 'AUTH_REQUIRED'
  | 'AGENT_NOT_FOUND'
  | 'MACHINE_NOT_FOUND'
  | 'MACHINE_OFFLINE'
  | 'RUNTIME_UNREACHABLE'
  | 'PERMISSION_DENIED';

export interface ConsultFailureEnvelope {
  ok: false;
  error: {
    code: ConsultErrorCode;
    message: string;
    actionable: string;
  };
  timestamp: string;
}

export interface ConsultSuccessEnvelope {
  ok: true;
  response: string;
  metadata?: Record<string, unknown>;
}

export type ConsultCommandResult = ConsultSuccessEnvelope | ConsultFailureEnvelope;

const ERROR_DETAILS: Record<ConsultErrorCode, { message: string; actionable: string }> = {
  AUTH_REQUIRED: {
    message: 'Authentication is required for consult.',
    actionable: 'Set a valid auth token in ~/.graphyn/auth.json and retry.',
  },
  AGENT_NOT_FOUND: {
    message: 'The specified agent UUID was not found.',
    actionable: 'Verify --agent-uuid belongs to your organization and retry.',
  },
  MACHINE_NOT_FOUND: {
    message: 'The specified machine tag was not found.',
    actionable: 'Verify --machine tag and ensure the desktop registered the device.',
  },
  MACHINE_OFFLINE: {
    message: 'The target machine runtime is offline.',
    actionable: 'Open the desktop runtime on that machine and retry.',
  },
  RUNTIME_UNREACHABLE: {
    message: 'The target runtime could not be reached.',
    actionable: 'Confirm ACP runtime health and network connectivity, then retry.',
  },
  PERMISSION_DENIED: {
    message: 'Access denied for consult on this target.',
    actionable: 'Use an authorized account or request permissions for this agent/machine.',
  },
};

export function failureEnvelope(code: ConsultErrorCode): ConsultFailureEnvelope {
  const detail = ERROR_DETAILS[code];
  return {
    ok: false,
    error: {
      code,
      message: detail.message,
      actionable: detail.actionable,
    },
    timestamp: new Date().toISOString(),
  };
}

export const createConsultFailureEnvelope = failureEnvelope;

export function isConsultFailureEnvelope(value: unknown): value is ConsultFailureEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  const error = obj.error as Record<string, unknown> | undefined;
  return (
    obj.ok === false &&
    typeof error?.code === 'string' &&
    typeof error?.message === 'string' &&
    typeof error?.actionable === 'string'
  );
}
