/**
 * Schedule SDK — type shapes and API class for the schedules domain.
 *
 * Vocabulary contract (§1 of schedule-cli-design-v1.md):
 *   CLI flag     → REST API field    → SDK input     → Pane prop
 *   --name       → name              → name          → value on <NameInput>
 *   --target     → target_machine_id → target        → value on <TargetPicker>
 *   --agent      → agent_id          → agent         → value on <AgentPicker>
 *   --mode       → mode_id           → mode          → value on <SessionModePicker>
 *   --tools      → tools_policy      → tools         → policy on <PermissionDots>
 *   --prompt     → kickoff_prompt    → prompt        → value on <ContentEditablePillComposer>
 *   --cron       → cron_expression   → cron          → value on <CronInput>
 *   --open-in-tab → open_in_tab     → openInTab     → toggle on <ToggleGroup>
 *   --enabled    → enabled           → enabled       → toggle on <ScheduleCard>
 */

export interface ToolsPolicy {
  allow: string[];
  ask: string[];
  deny: string[];
}

export type ScheduleStatus =
  | 'success'
  | 'failure'
  | 'skipped-offline'
  | 'skipped-revoked'
  | 'fired'
  | 'delivered';

export interface Schedule {
  id: string;
  name: string;
  ownerUserId: string;
  /** device-id or "@user:device-name" or "this-mac" */
  target: string;
  agent: string;
  mode: string;
  tools: ToolsPolicy;
  prompt: string;
  cron: string;
  /** ISO 8601 */
  nextRun: string;
  lastRun: string | null;
  lastStatus: ScheduleStatus | null;
  lastError: string | null;
  enabled: boolean;
  /** false = headless (default, Q2=2c) */
  openInTab: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduleInput {
  name: string;
  target: string;
  agent: string;
  mode: string;
  tools: ToolsPolicy;
  prompt: string;
  cron: string;
  /** default false (headless) */
  openInTab?: boolean;
  /** default true */
  enabled?: boolean;
}

export interface ListFilters {
  target?: string;
  status?: ScheduleStatus;
  enabled?: boolean;
}

export interface ScheduleRun {
  id: string;
  scheduleId: string;
  firedAt: string;
  deliveredAt: string | null;
  completedAt: string | null;
  status: ScheduleStatus;
  acpSessionId: string | null;
  errorMessage: string | null;
  durationMs: number | null;
}

export interface Grant {
  id: string;
  fromUserId: string;
  toUserId: string;
  deviceId: string;
  scope: 'fire';
  expiresAt: string | null;
  createdAt: string;
}

export interface CreateGrantInput {
  to: string;
  device: string;
  scope: 'fire';
  expires: 'never' | string;
}

/**
 * Lean device shape returned by `GET /admin/devices` (backyard
 * dto.DeviceSummary). Used to resolve the `this-mac` alias to a device UUID
 * for cross-device grants.
 */
export interface DeviceSummary {
  id: string;
  device_name: string;
  os: string;
  is_active: boolean;
  last_seen_at: string;
}

export interface RunsOptions {
  since?: string;
  status?: ScheduleStatus;
  limit?: number;
}

/**
 * Parses the flat --tools CLI flag into the structured ToolsPolicy type.
 * Format: "allow:tool1,tool2 ask:tool3 deny:tool4,tool5"
 * Round-trips losslessly — the serialized form can be pasted back as --tools.
 */
export function parseToolsFlag(s: string): ToolsPolicy {
  const parts = s.trim().split(/\s+/);
  const policy: ToolsPolicy = { allow: [], ask: [], deny: [] };
  for (const part of parts) {
    const colonIdx = part.indexOf(':');
    if (colonIdx === -1) continue;
    const key = part.slice(0, colonIdx) as keyof ToolsPolicy;
    const vals = part.slice(colonIdx + 1);
    if (key in policy) {
      policy[key] = vals.split(',').filter(Boolean);
    }
  }
  return policy;
}

/**
 * Serializes a ToolsPolicy to the compact string used in --tools flag output.
 * Only includes non-empty buckets.
 */
export function serializeToolsPolicy(policy: ToolsPolicy): string {
  const parts: string[] = [];
  if (policy.allow.length > 0) parts.push(`allow:${policy.allow.join(',')}`);
  if (policy.ask.length > 0) parts.push(`ask:${policy.ask.join(',')}`);
  if (policy.deny.length > 0) parts.push(`deny:${policy.deny.join(',')}`);
  return parts.join(' ');
}
