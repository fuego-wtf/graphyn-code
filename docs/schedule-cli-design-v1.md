# `graphyn schedule` — CLI & SDK Design v1

**Status:** DRAFT (design-only; no implementation claims)
**Date:** 2026-04-24
**Companion doc:** `docs/desktop/schedule-pane-design-v1.md` (UI Pane surface)
**Authority:** §9 of the Schedule Pane design — four-surface architecture
**Locks vocabulary for:** CLI flags ↔ REST API field names ↔ SDK input shapes ↔ pane prop names ↔ consult phrasing

---

## 0. Why this doc exists before any JSX

The Schedule Pane is one of four surfaces over the `schedules` table (UI Pane + CLI + Agent SDK + third-party consult via `@code`). The CLI vocabulary locks the names used across all four. Designing the pane first leads to prop names that don't match CLI flags don't match API fields or consult phrasing — the rename churn that makes products feel sloppy. This doc establishes the canonical vocabulary.

---

## 1. The vocabulary contract

| Concept | CLI flag | REST API field | SDK input | Pane prop |
|---|---|---|---|---|
| Display name | `--name` | `name` | `name` | `value` on `<NameInput>` |
| Target device | `--target` | `target_machine_id` | `target` | `value` on `<TargetPicker>` |
| Agent identity | `--agent` | `agent_id` | `agent` | `value` on `<AgentPicker>` |
| Mode | `--mode` | `mode_id` | `mode` | `value` on `<SessionModePicker>` |
| Tools policy | `--tools` (flat string) | `tools_policy` (JSONB) | `tools` (object) | `policy` on `<PermissionDots>` |
| Kickoff prompt | `--prompt` | `kickoff_prompt` | `prompt` | `value` on `<ContentEditablePillComposer>` |
| Cron expression | `--cron` | `cron_expression` | `cron` | `value` on `<CronInput>` |
| Run mode (Q2=2c) | `--headless` / `--open-in-tab` | `open_in_tab` (bool) | `openInTab` | toggle on `<ToggleGroup>` |
| Enabled state | `--enabled` / `--disabled` | `enabled` | `enabled` | toggle on `<ScheduleCard>` |

**Naming rules locked here:**
1. CLI is **kebab-case** (`--open-in-tab`).
2. API fields are **snake_case** (`open_in_tab`).
3. SDK inputs are **camelCase** (`openInTab`).
4. Pane props use whatever the design system component already exposes (`value`, `policy`, `enabled`).
5. **Conceptual names match across surfaces** — `target` everywhere, never "device" in one place and "machine" in another.

---

## 2. CLI surface — `graphyn schedule`

### 2.1 Authoring

```bash
# Create a schedule (own machine)
graphyn schedule create \
  --name "Daily Linear digest" \
  --target this-mac \
  --agent workflow-architect \
  --mode solo-coder \
  --tools "allow:read,write deny:bash" \
  --prompt "Digest yesterday's Linear activity" \
  --cron "0 9 * * *" \
  --headless

# Cross-device (target = teammate)
graphyn schedule create \
  --name "Friday PR digest" \
  --target @teammate:macbook-pro \
  --agent workflow-architect \
  --mode solo-coder \
  --tools "allow:read deny:bash" \
  --prompt "Friday PR digest" \
  --cron "0 17 * * 5" \
  --open-in-tab

# Edit
graphyn schedule edit <id> --prompt "New prompt text"
graphyn schedule edit <id> --cron "0 8 * * *"
```

### 2.2 Discovery

```bash
graphyn schedule list                          # all your schedules
graphyn schedule list --target this-mac        # filter by target
graphyn schedule list --target @teammate       # filter by user
graphyn schedule list --status failed          # filter by last status
graphyn schedule list --status skipped-offline # missed runs

graphyn schedule show <id>                     # full record
graphyn schedule runs <id>                     # run history (last 50)
graphyn schedule runs <id> --since 7d          # time-bounded
graphyn schedule runs <id> --status failed     # filter
```

### 2.3 Lifecycle mutation

```bash
graphyn schedule enable <id>
graphyn schedule disable <id>
graphyn schedule delete <id>
graphyn schedule run-now <id>                  # bypass cron, fire immediately
```

### 2.4 Cross-device grants (the trust subsystem)

```bash
# Grant scheduling access on YOUR machine to a teammate
graphyn schedule grant \
  --to @teammate \
  --device this-mac \
  --scope fire \
  --expires never                              # or 30d, 7d, custom

# Discovery
graphyn schedule grants list                   # grants you've issued
graphyn schedule grants list --received        # grants others issued to you
graphyn schedule grants show <grant-id>

# Revoke
graphyn schedule grants revoke <grant-id>      # immediate; auto-disables dependent schedules
```

### 2.5 Output formats

```bash
graphyn schedule list                          # human table (default)
graphyn schedule list --json                   # JSON for scripting
graphyn schedule list --ids                    # one id per line (pipe-friendly)
```

Pipe-friendly composition example:

```bash
# Disable all failing schedules in one shot
graphyn schedule list --status failed --ids | xargs -L1 graphyn schedule disable
```

---

## 3. SDK surface — `code/src/sdk/schedule.ts`

### 3.1 Type shapes

```typescript
// code/src/sdk/schedule.ts

export interface Schedule {
  id: string;
  name: string;
  ownerUserId: string;
  target: string;                   // device-id or "@user:device-name" or "this-mac"
  agent: string;
  mode: string;
  tools: ToolsPolicy;
  prompt: string;
  cron: string;
  nextRun: string;                  // ISO 8601
  lastRun: string | null;
  lastStatus: ScheduleStatus | null;
  lastError: string | null;
  enabled: boolean;
  openInTab: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ToolsPolicy {
  allow: string[];
  ask: string[];
  deny: string[];
}

export type ScheduleStatus =
  | "success"
  | "failure"
  | "skipped-offline"
  | "skipped-revoked"
  | "fired"
  | "delivered";

export interface CreateScheduleInput {
  name: string;
  target: string;
  agent: string;
  mode: string;
  tools: ToolsPolicy;
  prompt: string;
  cron: string;
  openInTab?: boolean;              // default false (headless, Q2=2c)
  enabled?: boolean;                // default true
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
```

### 3.2 API class

```typescript
export class ScheduleAPI {
  constructor(private client: GraphynClient) {}

  // CRUD
  list(filters?: ListFilters): Promise<Schedule[]>
  get(id: string): Promise<Schedule>
  create(input: CreateScheduleInput): Promise<Schedule>
  update(id: string, patch: Partial<CreateScheduleInput>): Promise<Schedule>
  delete(id: string): Promise<void>

  // Lifecycle
  enable(id: string): Promise<Schedule>
  disable(id: string): Promise<Schedule>
  runNow(id: string): Promise<ScheduleRun>

  // History
  runs(id: string, opts?: { since?: string; status?: ScheduleStatus; limit?: number }): Promise<ScheduleRun[]>

  // Grants subsystem
  grants: ScheduleGrantsAPI;
}

export class ScheduleGrantsAPI {
  list(opts?: { received?: boolean }): Promise<Grant[]>
  show(id: string): Promise<Grant>
  create(input: CreateGrantInput): Promise<Grant>
  revoke(id: string): Promise<void>
}
```

### 3.3 In-thread agent usage (the canonical example)

```typescript
import { ScheduleAPI } from "@graphyn/sdk";

// User in thread: "agent, schedule a digest of this conversation for me tomorrow at 9am"
// Agent action:
const sched = await new ScheduleAPI(client).create({
  target: "this-mac",
  agent: currentAgent.id,           // the agent answering
  mode: "solo-coder",
  tools: { allow: ["read"], ask: [], deny: ["bash", "write"] },
  prompt: `Digest the conversation at thread ${currentThreadId}. Summarize key decisions and open questions.`,
  cron: "0 9 * * *",
});

// Agent confirms to user:
return `Scheduled "${sched.prompt.slice(0, 40)}..." to fire daily at 9 AM. Schedule ID: ${sched.id}`;
```

### 3.4 Reactive list (for UI Pane consumption)

```typescript
// The pane subscribes to schedule changes via the same SDK.
// In production: WebSocket-backed; in prototype: polling stub.

const schedules$ = new ScheduleAPI(client).watch();
schedules$.subscribe(list => setSchedules(list));
```

---

## 4. REST API — `backyard/admin/schedules.go` (sketch)

```go
// CRUD
GET    /schedules                              // list with filters
GET    /schedules/:id                          // show
POST   /schedules                              // create
PATCH  /schedules/:id                          // update
DELETE /schedules/:id                          // delete

// Lifecycle
POST   /schedules/:id/enable
POST   /schedules/:id/disable
POST   /schedules/:id/run-now                  // returns ScheduleRun

// History
GET    /schedules/:id/runs                     // ?since=&status=&limit=

// Grants
GET    /schedule-grants                        // ?received=true
GET    /schedule-grants/:id
POST   /schedule-grants
DELETE /schedule-grants/:id                    // revoke

// Streaming (for SDK .watch())
WS     /schedules/stream                       // schedule.created/updated/deleted/fired
```

---

## 5. Tools policy serialization (the one tricky CLI flag)

The `--tools` flag is the only one that needs custom parsing because the underlying type is structured (3 lists) but CLI flags are flat strings.

**Format:** `--tools "allow:tool1,tool2 ask:tool3 deny:tool4,tool5"`

```typescript
function parseToolsFlag(s: string): ToolsPolicy {
  const parts = s.split(/\s+/);
  const policy: ToolsPolicy = { allow: [], ask: [], deny: [] };
  for (const part of parts) {
    const [key, vals] = part.split(":");
    if (key in policy) {
      (policy as any)[key] = vals.split(",").filter(Boolean);
    }
  }
  return policy;
}
```

**Reverse (for `graphyn schedule show`):**

```bash
$ graphyn schedule show abc123
...
Tools:    allow:read,write  ask:linear  deny:bash
...
```

Round-tripping is lossless — that flag value can be copy-pasted back into `--tools` on a new schedule.

---

## 6. Error handling vocabulary

CLI exit codes (used by automation):

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Generic error |
| 2 | Invalid input (bad cron, missing required flag) |
| 3 | Not found (`<id>` doesn't exist) |
| 4 | Permission denied (no grant for that target) |
| 5 | Conflict (duplicate, or schedule already in target state) |
| 6 | Backend unreachable |

SDK throws typed errors that map to those codes:

```typescript
class ScheduleNotFoundError extends Error { ... }     // exit 3
class ScheduleGrantRequiredError extends Error { ... } // exit 4
class ScheduleConflictError extends Error { ... }     // exit 5
class BackendUnreachableError extends Error { ... }   // exit 6
```

---

## 7. Cross-surface examples (the litmus test)

These **four** invocations are functionally identical — same backend mutation, four different invocation surfaces. (Updated 2026-04-24 to add the 3rd-party-via-`@code`-consult surface per the architectural correction in `docs/desktop/backbone-addendum-code-consult-proxy-correction-v1.md`.)

| # | Surface | Invocation |
|---|---|---|
| 1 | **Human in the UI** | Schedule Pane → `[+ New schedule]` → fill composer → `[Create schedule]` |
| 2 | **Human in terminal (CLI)** | `graphyn schedule create --name "Daily standup digest" --target this-mac --agent workflow-architect --mode solo-coder --tools "allow:read,write" --prompt "Daily standup digest" --cron "0 9 * * *"` |
| 3 | **Graphyn agent in a thread (SDK)** | `await sched.create({ target: "this-mac", agent: "workflow-architect", mode: "solo-coder", tools: { allow: ["read","write"], ask: [], deny: [] }, prompt: "Daily standup digest", cron: "0 9 * * *" })` |
| 4 | **3rd-party agent via `@code` consult** | `graphyn --agent-uuid <uuid> --machine this-mac "Schedule a daily standup digest at 9am — workflow-architect, solo-coder, read+write only"` |

**Surface 4 is the consult-proxy surface.** When a Codex or Cursor agent runs invocation 4, `@code` routes the consult to the Graphyn agent identified by `--agent-uuid` on the target machine. That Graphyn agent then performs invocation 3 (SDK call) from within its ACP session. The consult chain is 4 hops: external agent → `@code` proxy → Desktop ACP session → `ScheduleAPI` mutation → backyard.

**`@code` does not execute the mutation itself.** Per the correction addendum, `@code` is consult-proxy / CLI-junction, NOT runtime authority. Runtime is Desktop ACP.

**Input-transform parity (must-pass for consult invocations):** When invocation 4 produces ACP send messages, the transformation must follow §4 of the correction addendum — `original_input` preserved, explicit transform stages applied (`resolveSessionWhoHowWhat()` → `applyModeContractInjection()` → `applyKnowledgeContextInjection()` → `applyPolicyGuardrails()`), transform receipt emitted (`input_transform_chain`, `input_hash_before`, `input_hash_after`). The consult path's transformations must match the human path's policy for equivalent mode/session context. This is what makes invocations 1–4 truly equivalent — not just same backend mutation, but same audit trail.

**If any of these four diverge in field naming or transform discipline, the contract is broken.**

---

## 8. Open questions (CLI-specific operator decisions)

| # | Question | Lean |
|---|---|---|
| C1 | Should `graphyn schedule run-now` be sync (block until complete) or async (return run-id, exit immediately)? | **Async**, with `--wait` flag for sync mode. Long-running schedules shouldn't block the CLI. |
| C2 | Cron presets as flags? `--every-day-at "9am"` translating to `0 9 * * *`? | **Defer to v2.** Keep CLI lean; presets belong in the UI's CronInput. |
| C3 | Should `graphyn schedule create` prompt interactively if flags are missing, or hard-fail? | **Hard-fail in scripts (no TTY), interactive in TTY.** Standard Unix convention. |
| C4 | `--target this-mac` vs `--target $(hostname)` — do we accept literal hostnames or only the magic alias? | **Magic alias only** (`this-mac`, `@user:device-name`). Hostnames are too ambiguous. |
| C5 | Should the SDK's `watch()` stream survive backend disconnect (auto-reconnect)? | **Yes, with exponential backoff.** Mirrors the desktop ACP runtime's reconnect resilience. |

---

## 10. CapabilityRouter integration (where `graphyn schedule` plugs into `@code`)

Per `docs/desktop/backbone-addendum-code-consult-proxy-correction-v1.md` §3.3 + §5, `@code`'s `CapabilityRouter` routes capabilities by **domain**, not by transport. Schedule is a new domain — `schedule/*` — and warrants its own adapter.

### 10.1 Adapter registration

```
CapabilityRouter:
  base/* (in-process)                  → napi-rs FFI → packages/base addon
  base/* (third-party / cross-machine) → BaseCliAdapter → spawn graphyn-base --json
  external_mcp/*                       → MCPBridge (narrowed; non-base only)
  schedule/*  ← NEW                    → BackyardCliAdapter
  device/*    ← future                 → BackyardCliAdapter
  grant/*     ← future                 → BackyardCliAdapter
```

### 10.2 BackyardCliAdapter sketch

```typescript
// code/src/adapters/backyard-cli-adapter.ts (NEW)
export class BackyardCliAdapter implements CapabilityAdapter {
  async invoke<T>(req: BackyardCapabilityRequest): Promise<BackyardCapabilityResponse<T>> {
    // Authenticated REST call to backyard's /schedules, /devices, /schedule-grants endpoints.
    // Mirrors BaseCliAdapter's contract shape (timeout / exit-code / JSON parse / error normalization)
    // but uses HTTP transport because backyard is a network service, not a local CLI binary.
  }
}
```

### 10.3 Why a new adapter (and NOT `MCPBridge` or extending `BaseCliAdapter`)

- `MCPBridge` is narrowed post-cutover to non-base external MCP servers only. Shoehorning Graphyn-internal capabilities into MCPBridge re-creates the coupling the cutover removed.
- `BaseCliAdapter` is for `packages/base` — a local Rust CLI. `BackyardCliAdapter` is for backyard — a network REST API. Different transport, different lifecycle, different error envelope. Forcing one adapter to handle both inflates its surface area.
- Future capability domains (`device/*`, `grant/*`, `topology/*`) all live in backyard and reuse `BackyardCliAdapter`. Designing it now amortizes across the whole roadmap.

### 10.4 What does NOT change

- The CLI surface (§2), SDK surface (§3), REST endpoints (§4), and vocabulary contract (§1) are unchanged.
- The adapter is **invisible to the user and to thread agents** — they invoke via the CLI or SDK; the adapter is plumbing inside `@code`.

---

## 11. Status & next moves

- **This document:** DRAFT v1, design-only. Locks vocabulary.
- **Prototype unblocked:** `prototypes/desktop.jsx` Schedule Pane sketch can now use the locked names from §1 and the four-surface model from §7.
- **Operator-gated before any code:** C1–C5.
- **Backbone alignment:** Composes with `docs/desktop/backbone-addendum-code-consult-proxy-correction-v1.md` (the architectural correction this doc honors).
- **Composes with:** `docs/desktop/schedule-pane-design-v1.md` §9 (four-surface architecture).

---

## 12. Review-promotion blockers (2026-04-27)

These blockers are promoted in `docs/desktop/backbone-executable-unified-plan-addendum-v1.md` §0.5.206 and remain `[RESERVED]` until a sprint token moves them to `[WIP]`.

1. `T-REVIEW-SCHED-002 [RESERVED]`: `--name`/`name` and `--open-in-tab`/`open_in_tab`/`openInTab` are mandatory cross-surface fields.
2. `T-REVIEW-SCHED-003 [RESERVED]`: This CLI doc must keep four-surface wording and include the third-party consult surface via `@code`.
3. `T-REVIEW-SCHED-005 [RESERVED]`: Status filters and run statuses must use the canonical hyphenated vocabulary from the Schedule Pane design.
