# Base CLI Cutover Architecture — @code

> **Status update (2026-04-02):** This document is now a historical baseline.
> The current architecture direction is captured in:
> - `docs/superpowers/specs/2026-04-02-code-cross-machine-consult-and-knowledge-parity-design.md`
>
> Key correction:
> - `@code` is **not** runtime authority.
> - Desktop ACP runtime is authority.
> - `@code` is the consult/proxy entry surface (`--agent-uuid`, machine-tag routing).

Status: proposed (execution-ready architecture)
Date: 2026-04-02
Owner: Architect / DevOps

---

## 1) Why this matters

This cutover is launch-critical because grounded, source-backed answers must remain truthful while we remove fragile base-MCP coupling from `@code` runtime paths.

Goal: keep user flow identical while changing the transport contract for base capabilities from MCP-first to CLI-first.

---

## 2) AS-IS vs TO-BE

### AS-IS

```text
graphyn CLI command
  -> DynamicEngine
      -> GraphynMCPBridge (stdio MCP server assumptions)
          -> tool routing
              -> backend/repo capabilities
```

Current pain:
- Base capabilities are entangled with MCP lifecycle assumptions.
- Error/degraded states are transport-coupled, not capability-coupled.
- Launch trust for grounded answers depends on brittle wiring.

### TO-BE

```text
graphyn CLI command
  -> DynamicEngine
      -> CapabilityRouter
          -> BaseCliAdapter (PRIMARY for base capabilities)
              -> graphyn-base CLI (--json)
          -> MCPBridge (SECONDARY for non-base/external MCP only)
```

Outcome:
- Base capability execution is deterministic and transport-independent.
- Grounded-answer flow remains source-backed with explicit degraded truth.
- MCP remains available where it actually belongs (external integrations).

---

## 3) Architecture components

## 3.1 CapabilityRouter (new)

Responsibility:
- Route capabilities by domain, not by legacy transport.

Rules:
- `base/*` -> `BaseCliAdapter`
- `external_mcp/*` -> `GraphynMCPBridge`

## 3.2 BaseCliAdapter (new)

Responsibility:
- Spawn base CLI safely, parse JSON outputs, normalize errors.

Responsibilities include:
- timeout control
- exit-code classification
- JSON parse validation
- actionable error messages

## 3.3 BaseContractNormalizer (new)

Responsibility:
- map raw CLI payloads into stable internal contracts consumed by engine/UX.

## 3.4 GraphynMCPBridge (existing, narrowed)

Responsibility after cutover:
- handle only non-base MCP tools.
- no longer default path for base-critical execution.

---

## 4) Runtime contracts

## 4.1 Request envelope

```ts
type BaseCapabilityRequest = {
  capability:
    | "search_hybrid"
    | "search"
    | "index_directory"
    | "add_document"
    | "delete_document"
    | "stats";
  args: Record<string, unknown>;
  cwd?: string;
  projectId?: string;
  timeoutMs?: number;
};
```

## 4.2 Response envelope

```ts
type BaseCapabilityResponse<T> = {
  ok: boolean;
  data?: T;
  error?: {
    code:
      | "CLI_NOT_FOUND"
      | "TIMEOUT"
      | "BAD_JSON"
      | "NON_ZERO_EXIT"
      | "CONTRACT_MISMATCH";
    message: string;
    actionable?: string;
  };
  meta: {
    transport: "base-cli";
    latencyMs: number;
  };
};
```

Contract rule:
- Every failure must be explicit and user-actionable.
- Never fabricate grounded state on error/no results.

---

## 5) Critical sequence (grounded answer)

```text
User query
  -> DynamicEngine
  -> CapabilityRouter.route("search_hybrid")
  -> BaseCliAdapter.exec("graphyn-base ... --json")
  -> BaseContractNormalizer
  -> Engine composes response with ranked sources
  -> If no/failed retrieval: explicit ungrounded/degraded truth
```

---

## 6) File-level design (@code scope)

## Existing files to update
- `src/engines/dynamic-engine.ts`
- `src/mcp/bridge-implementation.ts`
- `src/commands/mcp-server.ts`
- `src/mcp/server-registry.ts`
- `src/unified-cli.ts` (if route wiring required)

## New files to add
- `src/capabilities/router.ts`
- `src/capabilities/base-cli-adapter.ts`
- `src/capabilities/base-contract.ts`
- `src/capabilities/base-normalizer.ts`

---

## 7) Rollout strategy

## Phase A — Adapter + contract
- add router + adapter + normalizer
- keep old MCP path behind feature flag

## Phase B — Cut critical flows
- migrate base-critical execution to router->CLI path

## Phase C — De-scope base MCP assumptions
- remove base-first assumptions from MCP command/registry surfaces

Feature flag:
- `GRAPHYN_BASE_TRANSPORT=cli|mcp`
- default target: `cli`

Rollback:
- one env switch to `mcp` during stabilization window

---

## 8) Backbone line items this architecture delivers

Primary:
- `T-KNOW-007` (per-message retrieval contract)

Supporting:
- `T-RAG-HOOK-001`
- `T-RAG-RRF-001`
- `T-RAG-CITE-001`
- non-regression guard for `T-KNOW-001` and `T-KNOW-006`

Must-win protection gates:
- ship lens from thread (`T-LENS-SYNTHESIS-001` path non-regression)
- resume thread on phone (`T-MOBILE-CONTINUATION-001` non-regression)
- WHO/HOW/WHAT pre-session (`T-MODES-008` non-regression)
- provider switch trust (`T-ACP-SRC-*`, `T-ACP-CONN-*`, `BUG-BLANK-003` guard)

---

## 9) Risk register (bumpy/jumpy)

1. CLI cold-start latency spikes on repeated retrieval.
2. JSON schema mismatch between CLI output and existing engine expectations.
3. Hidden MCP coupling in secondary code paths causing partial regressions.
4. Provider switch path showing blank/degraded without actionable reason.

Mitigation:
- strict normalizer
- explicit degraded truth
- staged flag rollout
- skeptic gate before closure claim

---

## 10) Acceptance criteria

1. Base-critical capability calls run through CLI-first path.
2. Grounded answers continue to show ranked sources or explicit ungrounded state.
3. No fake success states introduced.
4. Non-base MCP integrations remain functional.
5. Feature flag rollback path verified.
