/**
 * BackyardCliAdapter — authenticated HTTP transport for Graphyn-internal
 * backyard capabilities (schedules, devices, grants, …).
 *
 * Design contract: §10 of docs/code/schedule-cli-design-v1.md.
 *
 * This adapter is intentionally NOT MCPBridge (MCPBridge is for external MCP
 * servers only, post-cutover) and NOT BaseCliAdapter (BaseCliAdapter is for the
 * local packages/base Rust CLI). Backyard is a network REST service — it gets
 * its own adapter so the transport, error envelope, and auth lifecycle are
 * owned here rather than bolted onto another adapter.
 *
 * Exit-code vocabulary (§6 of design doc):
 *   0 success | 1 generic | 2 invalid input | 3 not found
 *   4 permission denied | 5 conflict | 6 backend unreachable
 */

import { ConfigManager } from '../config-manager.js';

// ─── Request / Response shapes ────────────────────────────────────────────────

export interface BackyardCapabilityRequest {
  /** e.g. "schedule/list", "schedule/create", "schedule/delete" */
  domain: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  query?: Record<string, string>;
}

export interface BackyardCapabilityResponse<T> {
  ok: true;
  data: T;
  statusCode: number;
}

// ─── Typed error codes ────────────────────────────────────────────────────────

export type BackyardErrorCode =
  | 'AUTH_REQUIRED'
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'CONFLICT'
  | 'BACKEND_UNREACHABLE';

export interface BackyardFailureEnvelope {
  ok: false;
  error: {
    code: BackyardErrorCode;
    message: string;
    actionable: string;
    details?: Record<string, unknown>;
  };
  timestamp: string;
}

export type BackyardResult<T> =
  | BackyardCapabilityResponse<T>
  | BackyardFailureEnvelope;

// ─── Exit-code mapping ────────────────────────────────────────────────────────

const CODE_TO_EXIT: Record<BackyardErrorCode, number> = {
  AUTH_REQUIRED: 1,
  INVALID_INPUT: 2,
  NOT_FOUND: 3,
  PERMISSION_DENIED: 4,
  CONFLICT: 5,
  BACKEND_UNREACHABLE: 6,
};

export function exitCodeForError(code: BackyardErrorCode): number {
  return CODE_TO_EXIT[code] ?? 1;
}

// ─── Error detail catalogue ───────────────────────────────────────────────────

const ERROR_DETAILS: Record<BackyardErrorCode, { message: string; actionable: string }> = {
  AUTH_REQUIRED: {
    message: 'Authentication is required for this backyard operation.',
    actionable: 'Ensure ~/.graphyn/auth.json is valid and retry.',
  },
  INVALID_INPUT: {
    message: 'The request contains invalid or missing fields.',
    actionable: 'Check required flags and retry (run --help for usage).',
  },
  NOT_FOUND: {
    message: 'The requested resource was not found.',
    actionable: 'Verify the ID exists and belongs to your organization, then retry.',
  },
  PERMISSION_DENIED: {
    message: 'Access denied — missing grant or insufficient role.',
    actionable: 'Request a cross-device grant or use an authorized account.',
  },
  CONFLICT: {
    message: 'The operation conflicts with existing state.',
    actionable: 'Resource may already exist or already be in the target state.',
  },
  BACKEND_UNREACHABLE: {
    message: 'The backyard API could not be reached.',
    actionable:
      'Confirm the backyard service is running (GRAPHYN_API_URL or http://localhost:4000) and retry.',
  },
};

function makeFailure(
  code: BackyardErrorCode,
  details?: Record<string, unknown>,
): BackyardFailureEnvelope {
  const detail = ERROR_DETAILS[code];
  return {
    ok: false,
    error: {
      code,
      message: detail.message,
      actionable: detail.actionable,
      ...(details ? { details } : {}),
    },
    timestamp: new Date().toISOString(),
  };
}

// ─── HTTP-status → error-code mapping ────────────────────────────────────────

function classifyHttpStatus(status: number, body: string): BackyardErrorCode {
  if (status === 401 || status === 403) return 'PERMISSION_DENIED';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409 || status === 422) return 'CONFLICT';
  if (status === 400) return 'INVALID_INPUT';
  // 5xx or network failures land here via the catch block
  const lower = body.toLowerCase();
  if (lower.includes('permission') || lower.includes('forbidden')) return 'PERMISSION_DENIED';
  if (lower.includes('not found')) return 'NOT_FOUND';
  return 'BACKEND_UNREACHABLE';
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class BackyardCliAdapter {
  private readonly baseUrl: string;
  private token: string | null = null;
  private initialized = false;
  private readonly configManager: ConfigManager;

  constructor(baseUrl?: string) {
    this.baseUrl =
      baseUrl ?? process.env.GRAPHYN_API_URL ?? 'http://localhost:4000';
    this.configManager = new ConfigManager();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.token = (await this.configManager.getAuthToken()) ?? null;
    this.initialized = true;
  }

  /**
   * Primary invocation surface. Called by CapabilityRouter after routing a
   * `schedule/*` (or future `device/*`, `grant/*`) request here.
   */
  async invoke<T>(req: BackyardCapabilityRequest): Promise<BackyardResult<T>> {
    await this.initialize();

    if (!this.token) {
      return makeFailure('AUTH_REQUIRED');
    }

    const url = this.buildUrl(req.path, req.query);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.token}`,
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: req.method,
        headers,
        ...(req.body !== undefined
          ? { body: JSON.stringify(req.body) }
          : {}),
      });
    } catch (err) {
      return makeFailure('BACKEND_UNREACHABLE', {
        url,
        reason: err instanceof Error ? err.message : String(err),
      });
    }

    const rawText = await response.text().catch(() => '');

    if (!response.ok) {
      const code = classifyHttpStatus(response.status, rawText);
      return makeFailure(code, {
        status: response.status,
        url,
        body: rawText.slice(0, 400),
      });
    }

    // 204 No Content (e.g. DELETE)
    if (response.status === 204 || rawText.trim() === '') {
      return { ok: true, data: undefined as unknown as T, statusCode: response.status };
    }

    let parsed: T;
    try {
      parsed = JSON.parse(rawText) as T;
    } catch {
      return makeFailure('BACKEND_UNREACHABLE', {
        reason: 'Invalid JSON in response',
        url,
        body: rawText.slice(0, 400),
      });
    }

    return { ok: true, data: parsed, statusCode: response.status };
  }

  private buildUrl(path: string, query?: Record<string, string>): string {
    const base = this.baseUrl.replace(/\/$/, '');
    const normalized = path.startsWith('/') ? path : `/${path}`;
    const url = `${base}${normalized}`;
    if (!query || Object.keys(query).length === 0) return url;
    const qs = new URLSearchParams(query).toString();
    return `${url}?${qs}`;
  }
}
