#!/usr/bin/env node
/**
 * graphyn schedule — CLI surface for the schedules domain.
 *
 * Contract: docs/code/schedule-cli-design-v1.md §2 (CLI surface) + §1 (vocabulary).
 *
 * Subcommands:
 *   create   Create a new schedule
 *   list     List schedules (with optional filters)
 *   show     Show a single schedule
 *   edit     Patch one or more fields on an existing schedule
 *   enable   Enable a schedule
 *   disable  Disable a schedule
 *   delete   Delete a schedule
 *   run-now  Fire a schedule immediately (async by default; --wait for sync)
 *   runs     Show run history for a schedule
 *   grant    Issue a cross-device scheduling grant
 *   grants   Grant sub-surface: list | show | revoke
 *
 * Output:
 *   Default: human-readable table/summary
 *   --json:  Machine-readable JSON (CLI-first JSON contract)
 *   --ids:   One id per line (pipe-friendly)
 *
 * Exit codes (§6):
 *   0 success | 1 generic | 2 invalid input | 3 not found
 *   4 permission denied | 5 conflict | 6 backend unreachable
 */

import chalk from 'chalk';
import {
  BackyardCliAdapter,
  exitCodeForError,
  type BackyardFailureEnvelope,
  type BackyardResult,
} from '../adapters/backyard-cli-adapter.js';
import {
  parseToolsFlag,
  serializeToolsPolicy,
  type Schedule,
  type ScheduleRun,
  type Grant,
  type ToolsPolicy,
  type DeviceSummary,
} from '../sdk/schedule.js';

// ─── Colors ───────────────────────────────────────────────────────────────────

const c = {
  bold: chalk.bold,
  dim: chalk.dim,
  error: chalk.red,
  warn: chalk.yellow,
  ok: chalk.green,
  info: chalk.gray,
  hl: chalk.cyan,
};

// ─── Token parsing ────────────────────────────────────────────────────────────

/**
 * Minimal token-list parser (mirrors the pattern established in base.ts).
 * Handles: positional args, --flag value pairs, boolean --flags.
 */
interface Tokens {
  positional: string[];
  flags: Record<string, string | boolean>;
}

function tokenize(tokens: string[]): Tokens {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok === '--') {
      // Everything after -- is positional
      positional.push(...tokens.slice(i + 1));
      break;
    }
    if (tok.startsWith('--')) {
      const key = tok.slice(2);
      const next = tokens[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i += 2;
      } else {
        flags[key] = true;
        i += 1;
      }
    } else {
      positional.push(tok);
      i += 1;
    }
  }

  return { positional, flags };
}

function flag(t: Tokens, name: string): string | undefined {
  const v = t.flags[name];
  return typeof v === 'string' ? v : undefined;
}

function boolFlag(t: Tokens, name: string): boolean {
  return t.flags[name] === true || t.flags[name] === 'true';
}

// ─── Output helpers ───────────────────────────────────────────────────────────

function emitJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function emitFailure(envelope: BackyardFailureEnvelope): void {
  emitJson(envelope);
}

function handleResult<T>(
  result: BackyardResult<T>,
  onSuccess: (data: T) => void,
  onFailure?: (env: BackyardFailureEnvelope) => void,
): void {
  if (result.ok) {
    onSuccess(result.data);
    return;
  }
  if (onFailure) {
    onFailure(result);
  } else {
    emitFailure(result);
  }
  process.exitCode = exitCodeForError(result.error.code);
}

// ─── Human-readable formatters ────────────────────────────────────────────────

function formatSchedule(s: Schedule): string {
  const status = s.enabled ? c.ok('enabled') : c.warn('disabled');
  const runMode = s.openInTab ? 'open-in-tab' : 'headless';
  const tools = serializeToolsPolicy(s.tools);
  return [
    `${c.bold(s.name)}  ${c.dim(s.id)}`,
    `  Target:   ${s.target}`,
    `  Agent:    ${s.agent}  Mode: ${s.mode}`,
    `  Cron:     ${s.cron}  (${runMode})`,
    `  Tools:    ${tools || '(none)'}`,
    `  Prompt:   ${s.prompt.slice(0, 80)}${s.prompt.length > 80 ? '…' : ''}`,
    `  Status:   ${status}  Last: ${s.lastStatus ?? 'n/a'}`,
    `  Next run: ${s.nextRun}`,
  ].join('\n');
}

function formatScheduleRow(s: Schedule): string {
  const status = s.enabled ? c.ok('on ') : c.warn('off');
  const name = s.name.slice(0, 30).padEnd(30);
  const cron = s.cron.padEnd(12);
  return `${status}  ${c.dim(s.id.slice(0, 8))}  ${name}  ${cron}  ${s.target}`;
}

function formatRun(r: ScheduleRun): string {
  const statusColor =
    r.status === 'success' ? c.ok : r.status === 'failure' ? c.error : c.warn;
  const dur = r.durationMs != null ? ` (${r.durationMs}ms)` : '';
  return `  ${c.dim(r.id.slice(0, 8))}  ${statusColor(r.status)}${dur}  ${r.firedAt}`;
}

function formatGrant(g: Grant): string {
  return (
    `${c.dim(g.id.slice(0, 8))}  to:${g.toUserId}  device:${g.deviceId}` +
    `  scope:${g.scope}  expires:${g.expiresAt ?? 'never'}`
  );
}

// ─── API helpers ──────────────────────────────────────────────────────────────

function getAdapter(): BackyardCliAdapter {
  return new BackyardCliAdapter();
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DeviceResolution =
  | { ok: true; deviceId: string }
  | { ok: false; failure: BackyardFailureEnvelope };

function deviceFailure(
  code: BackyardFailureEnvelope['error']['code'],
  message: string,
  actionable: string,
): DeviceResolution {
  return {
    ok: false,
    failure: {
      ok: false,
      error: { code, message, actionable },
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Resolves a --device value to a device UUID for cross-device grants.
 *
 * - A literal UUID passes through unchanged.
 * - The magic alias `this-mac` resolves against `GET /admin/devices`. Backyard
 *   does not expose a server-side `is_local` flag (per dto.DeviceSummary the
 *   caller is expected to know its own device id), and `code` does not persist
 *   a local device id. So `this-mac` resolves to the active device with the
 *   most recent `last_seen_at` — the desktop runtime keeps itself active via
 *   heartbeat. Ambiguity (zero active devices) fails fast rather than guessing.
 */
async function resolveDeviceId(
  adapter: BackyardCliAdapter,
  device: string,
): Promise<DeviceResolution> {
  if (UUID_RE.test(device)) {
    return { ok: true, deviceId: device };
  }

  if (device !== 'this-mac') {
    return deviceFailure(
      'INVALID_INPUT',
      `Unrecognized --device value "${device}".`,
      'Use the magic alias `this-mac` or pass a device UUID directly.',
    );
  }

  const result = await adapter.invoke<{ devices: DeviceSummary[] }>({
    domain: 'device/list',
    method: 'GET',
    path: '/admin/devices',
  });

  if (!result.ok) {
    return { ok: false, failure: result };
  }

  const devices = result.data?.devices ?? [];
  const active = devices.filter(d => d.is_active);

  if (active.length === 0) {
    return deviceFailure(
      'NOT_FOUND',
      'Could not resolve `this-mac` — no active device found for your account.',
      'Open the Graphyn desktop runtime on this machine so it registers an active device, then retry. ' +
        'Alternatively pass a device UUID directly to --device.',
    );
  }

  // Most-recently-seen active device is the best proxy for "this machine".
  active.sort(
    (a, b) =>
      new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime(),
  );
  const chosen = active[0];
  return { ok: true, deviceId: chosen.id };
}

// ─── Subcommand: create ───────────────────────────────────────────────────────

async function cmdCreate(t: Tokens, jsonMode: boolean): Promise<void> {
  const name = flag(t, 'name');
  const target = flag(t, 'target');
  const agent = flag(t, 'agent');
  const mode = flag(t, 'mode');
  const toolsRaw = flag(t, 'tools');
  const prompt = flag(t, 'prompt');
  const cron = flag(t, 'cron');
  const headless = boolFlag(t, 'headless');
  const openInTab = boolFlag(t, 'open-in-tab');
  const enabled = !boolFlag(t, 'disabled');

  const missing: string[] = [];
  if (!name) missing.push('--name');
  if (!target) missing.push('--target');
  if (!agent) missing.push('--agent');
  if (!mode) missing.push('--mode');
  if (!prompt) missing.push('--prompt');
  if (!cron) missing.push('--cron');

  if (missing.length > 0) {
    const env: BackyardFailureEnvelope = {
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message: `Missing required flags: ${missing.join(', ')}`,
        actionable: 'Provide all required flags and retry (graphyn schedule create --help).',
      },
      timestamp: new Date().toISOString(),
    };
    emitFailure(env);
    process.exitCode = 2;
    return;
  }

  const tools: ToolsPolicy = toolsRaw
    ? parseToolsFlag(toolsRaw)
    : { allow: [], ask: [], deny: [] };

  const body = {
    name,
    target_machine_id: target,
    agent_id: agent,
    mode_id: mode,
    tools_policy: tools,
    kickoff_prompt: prompt,
    cron_expression: cron,
    open_in_tab: openInTab && !headless,
    enabled,
  };

  const adapter = getAdapter();
  // Single-resource create → bare Schedule.
  const result = await adapter.invoke<Schedule>({
    domain: 'schedule/create',
    method: 'POST',
    path: '/admin/schedules',
    body,
  });

  handleResult(result, data => {
    if (jsonMode) {
      emitJson({ ok: true, schedule: data });
    } else {
      console.log(c.ok('Created schedule:'));
      console.log(formatSchedule(data));
    }
  });
}

// ─── Subcommand: list ─────────────────────────────────────────────────────────

async function cmdList(t: Tokens, jsonMode: boolean, idsMode: boolean): Promise<void> {
  const query: Record<string, string> = {};
  const targetFilter = flag(t, 'target');
  const statusFilter = flag(t, 'status');
  const enabledStr = flag(t, 'enabled');

  if (targetFilter) query.target = targetFilter;
  if (statusFilter) query.status = statusFilter;
  if (enabledStr !== undefined) query.enabled = enabledStr;

  const adapter = getAdapter();
  // Encore wraps list responses: { schedules: Schedule[] }.
  const result = await adapter.invoke<{ schedules: Schedule[] }>({
    domain: 'schedule/list',
    method: 'GET',
    path: '/admin/schedules',
    query,
  });

  handleResult(result, payload => {
    const data = payload?.schedules ?? [];
    if (idsMode) {
      data.forEach(s => console.log(s.id));
      return;
    }
    if (jsonMode) {
      emitJson({ ok: true, schedules: data, count: data.length });
      return;
    }
    if (data.length === 0) {
      console.log(c.dim('No schedules found.'));
      return;
    }
    console.log(c.bold(`Schedules (${data.length})`));
    data.forEach(s => console.log(formatScheduleRow(s)));
  });
}

// ─── Subcommand: show ─────────────────────────────────────────────────────────

async function cmdShow(id: string, jsonMode: boolean): Promise<void> {
  const adapter = getAdapter();
  // Single-resource GET → bare Schedule.
  const result = await adapter.invoke<Schedule>({
    domain: 'schedule/get',
    method: 'GET',
    path: `/admin/schedules/${encodeURIComponent(id)}`,
  });

  handleResult(result, data => {
    if (jsonMode) {
      emitJson({ ok: true, schedule: data });
    } else {
      console.log(formatSchedule(data));
    }
  });
}

// ─── Subcommand: edit ─────────────────────────────────────────────────────────

async function cmdEdit(id: string, t: Tokens, jsonMode: boolean): Promise<void> {
  const patch: Record<string, unknown> = {};

  const name = flag(t, 'name');
  const target = flag(t, 'target');
  const agent = flag(t, 'agent');
  const mode = flag(t, 'mode');
  const toolsRaw = flag(t, 'tools');
  const prompt = flag(t, 'prompt');
  const cron = flag(t, 'cron');

  if (name) patch.name = name;
  if (target) patch.target_machine_id = target;
  if (agent) patch.agent_id = agent;
  if (mode) patch.mode_id = mode;
  if (toolsRaw) patch.tools_policy = parseToolsFlag(toolsRaw);
  if (prompt) patch.kickoff_prompt = prompt;
  if (cron) patch.cron_expression = cron;

  if (t.flags['open-in-tab'] !== undefined) patch.open_in_tab = true;
  if (t.flags['headless'] !== undefined) patch.open_in_tab = false;
  if (t.flags['enabled'] !== undefined) patch.enabled = true;
  if (t.flags['disabled'] !== undefined) patch.enabled = false;

  if (Object.keys(patch).length === 0) {
    const env: BackyardFailureEnvelope = {
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'No fields to update — provide at least one flag.',
        actionable: 'Run `graphyn schedule edit <id> --help` to see available flags.',
      },
      timestamp: new Date().toISOString(),
    };
    emitFailure(env);
    process.exitCode = 2;
    return;
  }

  const adapter = getAdapter();
  // Single-resource PATCH → bare Schedule.
  const result = await adapter.invoke<Schedule>({
    domain: 'schedule/update',
    method: 'PATCH',
    path: `/admin/schedules/${encodeURIComponent(id)}`,
    body: patch,
  });

  handleResult(result, data => {
    if (jsonMode) {
      emitJson({ ok: true, schedule: data });
    } else {
      console.log(c.ok('Updated schedule:'));
      console.log(formatSchedule(data));
    }
  });
}

// ─── Subcommand: enable / disable ────────────────────────────────────────────

async function cmdToggle(
  id: string,
  action: 'enable' | 'disable',
  jsonMode: boolean,
): Promise<void> {
  const adapter = getAdapter();
  // Lifecycle toggle → bare Schedule.
  const result = await adapter.invoke<Schedule>({
    domain: `schedule/${action}`,
    method: 'POST',
    path: `/admin/schedules/${encodeURIComponent(id)}/${action}`,
  });

  handleResult(result, data => {
    if (jsonMode) {
      emitJson({ ok: true, schedule: data });
    } else {
      const verb = action === 'enable' ? c.ok('Enabled') : c.warn('Disabled');
      console.log(`${verb}: ${data.name}  (${data.id})`);
    }
  });
}

// ─── Subcommand: delete ───────────────────────────────────────────────────────

async function cmdDelete(id: string, jsonMode: boolean): Promise<void> {
  const adapter = getAdapter();
  // DELETE → { deleted: true }.
  const result = await adapter.invoke<{ deleted: boolean }>({
    domain: 'schedule/delete',
    method: 'DELETE',
    path: `/admin/schedules/${encodeURIComponent(id)}`,
  });

  handleResult(result, payload => {
    const deleted = payload?.deleted ?? true;
    if (jsonMode) {
      emitJson({ ok: true, deleted, id });
    } else {
      console.log(c.ok(`Deleted schedule ${id}`));
    }
  });
}

// ─── Subcommand: run-now ──────────────────────────────────────────────────────

async function cmdRunNow(id: string, t: Tokens, jsonMode: boolean): Promise<void> {
  const waitMode = boolFlag(t, 'wait');

  const adapter = getAdapter();
  // run-now → bare ScheduleRun.
  const result = await adapter.invoke<ScheduleRun>({
    domain: 'schedule/run-now',
    method: 'POST',
    path: `/admin/schedules/${encodeURIComponent(id)}/run-now`,
    ...(waitMode ? { body: { wait: true } } : {}),
  });

  handleResult(result, data => {
    if (jsonMode) {
      emitJson({ ok: true, run: data });
    } else {
      console.log(c.ok('Fired run:'));
      console.log(formatRun(data));
    }
  });
}

// ─── Subcommand: runs ─────────────────────────────────────────────────────────

async function cmdRuns(id: string, t: Tokens, jsonMode: boolean): Promise<void> {
  const query: Record<string, string> = {};
  const since = flag(t, 'since');
  const status = flag(t, 'status');
  const limit = flag(t, 'limit');

  if (since) query.since = since;
  if (status) query.status = status;
  if (limit) query.limit = limit;

  const adapter = getAdapter();
  // Encore wraps list responses: { runs: ScheduleRun[] }.
  const result = await adapter.invoke<{ runs: ScheduleRun[] }>({
    domain: 'schedule/runs',
    method: 'GET',
    path: `/admin/schedules/${encodeURIComponent(id)}/runs`,
    query,
  });

  handleResult(result, payload => {
    const data = payload?.runs ?? [];
    if (jsonMode) {
      emitJson({ ok: true, runs: data, count: data.length });
      return;
    }
    if (data.length === 0) {
      console.log(c.dim('No runs found.'));
      return;
    }
    console.log(c.bold(`Runs for ${id} (${data.length})`));
    data.forEach(r => console.log(formatRun(r)));
  });
}

// ─── Subcommand: grant ────────────────────────────────────────────────────────

async function cmdGrant(t: Tokens, jsonMode: boolean): Promise<void> {
  const to = flag(t, 'to');
  const device = flag(t, 'device');
  const scope = flag(t, 'scope') ?? 'fire';
  const expires = flag(t, 'expires') ?? 'never';

  const missing: string[] = [];
  if (!to) missing.push('--to');
  if (!device) missing.push('--device');

  if (missing.length > 0) {
    const env: BackyardFailureEnvelope = {
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message: `Missing required flags: ${missing.join(', ')}`,
        actionable: 'Provide --to <@user|user-uuid> and --device <this-mac|device-uuid> and retry.',
      },
      timestamp: new Date().toISOString(),
    };
    emitFailure(env);
    process.exitCode = 2;
    return;
  }

  const adapter = getAdapter();

  // Backyard takes UUIDs (grantee_user_id + device_id) with NO server-side
  // alias resolution, so resolve the --device alias to a UUID before POST.
  const deviceResolution = await resolveDeviceId(adapter, device as string);
  if (!deviceResolution.ok) {
    emitFailure(deviceResolution.failure);
    process.exitCode = exitCodeForError(deviceResolution.failure.error.code);
    return;
  }
  const deviceId = deviceResolution.deviceId;

  // --to: a literal user UUID is sent through; an `@user` alias cannot be
  // resolved yet because no user-lookup endpoint is available. Fail fast and
  // flag the gap rather than POSTing the literal alias (which the backend would
  // reject as an invalid grantee_user_id).
  let granteeUserId: string;
  if (UUID_RE.test(to as string)) {
    granteeUserId = to as string;
  } else {
    const env: BackyardFailureEnvelope = {
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message: `Cannot resolve --to "${to}" to a user UUID.`,
        actionable:
          'Backyard has no user-lookup endpoint yet, so `@user` aliases cannot be ' +
          'resolved to grantee_user_id. Pass a user UUID directly to --to. ' +
          '[CONTRACT GAP: needs a GET /admin/users?handle=@user lookup endpoint.]',
      },
      timestamp: new Date().toISOString(),
    };
    emitFailure(env);
    process.exitCode = 2;
    return;
  }

  const result = await adapter.invoke<Grant>({
    domain: 'grant/create',
    method: 'POST',
    path: '/admin/schedule-grants',
    body: {
      grantee_user_id: granteeUserId,
      device_id: deviceId,
      scope,
      expires,
    },
  });

  handleResult(result, data => {
    if (jsonMode) {
      emitJson({ ok: true, grant: data });
    } else {
      console.log(c.ok('Grant issued:'));
      console.log(formatGrant(data));
    }
  });
}

// ─── Subcommand: grants ───────────────────────────────────────────────────────

async function cmdGrants(subArgs: string[], jsonMode: boolean): Promise<void> {
  const [action, id] = subArgs;

  if (!action || action === 'list') {
    const t = tokenize(subArgs.slice(1));
    const received = boolFlag(t, 'received');
    const query: Record<string, string> = received ? { received: 'true' } : {};
    const adapter = getAdapter();
    // Encore wraps list responses: { grants: Grant[] }.
    const result = await adapter.invoke<{ grants: Grant[] }>({
      domain: 'grant/list',
      method: 'GET',
      path: '/admin/schedule-grants',
      query,
    });
    handleResult(result, payload => {
      const data = payload?.grants ?? [];
      if (jsonMode) {
        emitJson({ ok: true, grants: data, count: data.length });
        return;
      }
      if (data.length === 0) {
        console.log(c.dim('No grants found.'));
        return;
      }
      console.log(c.bold(`Grants (${data.length})`));
      data.forEach(g => console.log(formatGrant(g)));
    });
    return;
  }

  if (action === 'show' && id) {
    const adapter = getAdapter();
    // Single-resource GET → bare Grant.
    const result = await adapter.invoke<Grant>({
      domain: 'grant/get',
      method: 'GET',
      path: `/admin/schedule-grants/${encodeURIComponent(id)}`,
    });
    handleResult(result, data => {
      if (jsonMode) {
        emitJson({ ok: true, grant: data });
      } else {
        console.log(formatGrant(data));
      }
    });
    return;
  }

  if (action === 'revoke' && id) {
    const adapter = getAdapter();
    // revoke → { revoked: true }.
    const result = await adapter.invoke<{ revoked: boolean }>({
      domain: 'grant/revoke',
      method: 'DELETE',
      path: `/admin/schedule-grants/${encodeURIComponent(id)}`,
    });
    handleResult(result, payload => {
      const revoked = payload?.revoked ?? true;
      if (jsonMode) {
        emitJson({ ok: true, revoked, id });
      } else {
        console.log(c.ok(`Revoked grant ${id}`));
      }
    });
    return;
  }

  console.log(c.error('Unknown grants subcommand. Usage: grants list | show <id> | revoke <id>'));
  process.exitCode = 2;
}

// ─── Help ─────────────────────────────────────────────────────────────────────

function showHelp(): void {
  console.log(`
${c.bold('graphyn schedule')} — Manage scheduled agent runs

${c.hl('Authoring')}
  schedule create --name <str> --target <str> --agent <str> --mode <str>
                  --prompt <str> --cron <expr> [--tools <policy>]
                  [--headless|--open-in-tab] [--disabled]
  schedule edit <id> [--name|--target|--agent|--mode|--prompt|--cron|--tools
                      --enabled|--disabled|--headless|--open-in-tab]

${c.hl('Discovery')}
  schedule list [--target <str>] [--status <str>] [--enabled]
  schedule show <id>
  schedule runs <id> [--since 7d] [--status failed] [--limit 50]

${c.hl('Lifecycle')}
  schedule enable <id>
  schedule disable <id>
  schedule delete <id>
  schedule run-now <id> [--wait]

${c.hl('Cross-device grants')}
  schedule grant --to <user-uuid> --device <this-mac|device-uuid> [--scope fire] [--expires never|30d]
                 (this-mac resolves to your active device; @user aliases need a
                  user-lookup endpoint — pass a user UUID for now)
  schedule grants list [--received]
  schedule grants show <id>
  schedule grants revoke <id>

${c.hl('Output')}
  --json    Machine-readable JSON
  --ids     One id per line (pipe-friendly, list only)

${c.hl('Tools policy format')}
  "allow:read,write ask:linear deny:bash"
  Round-trips losslessly (copy-paste from show → create --tools).

${c.hl('Exit codes')}
  0 success  1 generic  2 invalid input  3 not found
  4 permission denied  5 conflict  6 backend unreachable
`);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Main entry called by index.ts when the raw query starts with "schedule".
 *
 * @param rawQuery  The full raw query string, e.g. "schedule list --json"
 */
export async function runScheduleCommand(rawQuery: string): Promise<void> {
  // Strip the leading "schedule" token, then tokenize the rest
  const tokens = rawQuery.trim().split(/\s+/);
  // tokens[0] === "schedule"
  const rest = tokens.slice(1);

  if (rest.length === 0 || rest[0] === '--help' || rest[0] === '-h') {
    showHelp();
    return;
  }

  const [subcommand, ...subArgs] = rest;
  const t = tokenize(subArgs);
  const jsonMode = boolFlag(t, 'json');
  const idsMode = boolFlag(t, 'ids');

  try {
    switch (subcommand) {
      case 'create':
        await cmdCreate(t, jsonMode);
        break;

      case 'list':
        await cmdList(t, jsonMode, idsMode);
        break;

      case 'show': {
        const id = t.positional[0] ?? subArgs[0];
        if (!id) {
          console.error(c.error('Usage: graphyn schedule show <id>'));
          process.exitCode = 2;
          return;
        }
        await cmdShow(id, jsonMode);
        break;
      }

      case 'edit': {
        const id = t.positional[0] ?? subArgs[0];
        if (!id) {
          console.error(c.error('Usage: graphyn schedule edit <id> [flags]'));
          process.exitCode = 2;
          return;
        }
        await cmdEdit(id, t, jsonMode);
        break;
      }

      case 'enable': {
        const id = t.positional[0] ?? subArgs[0];
        if (!id) {
          console.error(c.error('Usage: graphyn schedule enable <id>'));
          process.exitCode = 2;
          return;
        }
        await cmdToggle(id, 'enable', jsonMode);
        break;
      }

      case 'disable': {
        const id = t.positional[0] ?? subArgs[0];
        if (!id) {
          console.error(c.error('Usage: graphyn schedule disable <id>'));
          process.exitCode = 2;
          return;
        }
        await cmdToggle(id, 'disable', jsonMode);
        break;
      }

      case 'delete': {
        const id = t.positional[0] ?? subArgs[0];
        if (!id) {
          console.error(c.error('Usage: graphyn schedule delete <id>'));
          process.exitCode = 2;
          return;
        }
        await cmdDelete(id, jsonMode);
        break;
      }

      case 'run-now': {
        const id = t.positional[0] ?? subArgs[0];
        if (!id) {
          console.error(c.error('Usage: graphyn schedule run-now <id> [--wait]'));
          process.exitCode = 2;
          return;
        }
        await cmdRunNow(id, t, jsonMode);
        break;
      }

      case 'runs': {
        const id = t.positional[0] ?? subArgs[0];
        if (!id) {
          console.error(c.error('Usage: graphyn schedule runs <id> [--since 7d] [--status failed]'));
          process.exitCode = 2;
          return;
        }
        // Re-tokenize without the id position consumed
        const runsT = tokenize(subArgs.filter((_, i) => i !== 0));
        await cmdRuns(id, runsT, jsonMode);
        break;
      }

      case 'grant':
        await cmdGrant(t, jsonMode);
        break;

      case 'grants':
        await cmdGrants(subArgs, jsonMode);
        break;

      default:
        console.error(c.error(`Unknown schedule subcommand: ${subcommand}`));
        showHelp();
        process.exitCode = 2;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (jsonMode) {
      emitJson({
        ok: false,
        error: { code: 'BACKEND_UNREACHABLE', message: msg },
        timestamp: new Date().toISOString(),
      });
    } else {
      console.error(c.error(`Error: ${msg}`));
    }
    process.exitCode = 6;
  }
}
