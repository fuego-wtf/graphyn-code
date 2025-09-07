# Graphyn Code CLI Developer — Due Diligence: Deep Research Orchestrated Implementation

Status: Draft for execution
Owner: CLI Orchestration Team (@code)
Scope: Implement “Life After Graphyn” user story (deep research + multi‑agent orchestration) in the @code CLI, using a fastlane surface: `graphyn` and `graphyn "<user query>"`. All other actions run under the hood.

## 0) Executive Summary

We will deliver an automated, context‑aware implementation pipeline that performs: environment detection, documentation research, design extraction, repository intelligence, DAG planning, parallel execution, and safe git automation — all from a single fastlane CLI surface. We will reuse existing orchestrator and analysis modules, introduce minimal glue code, and enforce consistent code quality (ESLint) across repos (excluding @desktop for now).

Key outcomes:
- One command fastlane, everything else implicit.
- True parallel execution (5–8) with safe worktrees and auto commits.
- Deep research (Perplexity/Figma/GitHub MCP where available), offline‑first fallbacks.
- First‑class artifacts: PLAN.md, CONTEXT.md, PROGRESS.json, events.ndjson.
- ESLint rules applied in all repos (except @desktop), with a conversion plan for Electron later.

## 1) Assumptions & Non‑Goals

Assumptions:
- Claude CLI (`claude`) is installed and available; SDK may not be.
- Backend/Backyard services may be offline; system remains functional and degrades gracefully.
- Git is present; repo is a valid git repository for worktrees/commits.

Non‑Goals (Phase 1):
- No new public CLI commands beyond the fastlane.
- No GUI/TUI beyond compact console dashboard.
- No hard dependency on external MCPs; use when present, skip otherwise.

## 2) Current State (What we have)

- Orchestration core: `code/src/orchestrator/{graph-builder.ts,graph-flow-engine.ts,graph-neural-system.ts,output-propagator.ts}`
- Claude wrappers/spawn paths: `claude-wrapper.ts`, `claude-session-spawner.ts`, `SessionPoolManager.ts`, plus direct spawns in `graph-flow-engine.ts` and `commands/orchestrate.ts`.
- Repo analysis: `services/repository-analyzer.ts`, context builders.
- Figma integration: `figma-api.ts` (REST). MCP bridge minimal.
- CLI entry: `bin/graphyn.js` → `dist/cli-orchestrator.js` → `src/cli-main.ts`/`commands/orchestrate.ts`.

Gaps:
- Multiple Claude spawn paths; inconsistent behavior and telemetry.
- API client duplication (`src/api/client.ts` axios vs `src/api-client.ts` fetch).
- No guaranteed PLAN/CONTEXT/PROGRESS write‑through in the run path.
- Git automation uses shell strings; needs safer spawn/simple‑git.
- No central event log for desktop sync.

## 3) Capability Mapping (Required → Current → Action)

- System detection (OS, Node, services, MCPs)
  - Current: partial capability via utils + shell
  - Action: add `system-detector` module; parallel exec minimal probes; cache results.

- Documentation research (Perplexity MCP)
  - Current: MCP infra minimal
  - Action: optional “enhancer” hook; if MCP present, run multi‑query search; otherwise skip.

- Design integration (Figma)
  - Current: `figma-api.ts` (token‑based)
  - Action: reuse direct API; add small “design context” builder for frontend prompts.

- Repo intelligence (GitHub MCP)
  - Current: no direct MCP; local git available
  - Action: fallback local analysis (git log/grep); use MCP if present.

- DAG planning & parallel execution
  - Current: implemented (builder + flow engine)
  - Action: wire fastlane to `graph‑flow/graph‑neural` path; set `maxParallel` by config.

- Unified Claude integration
  - Current: multiple spawn routes
  - Action: route all calls through `ClaudeCodeWrapper.executeQuery()`; remove direct spawns.

- Artifacts & sync
  - Current: node I/O files exist; not guaranteed in fastlane; no events log
  - Action: always write PLAN.md, CONTEXT.md, PROGRESS.json; append `state/runs/<id>/events.ndjson`.

- Git automation
  - Current: worktrees via shell strings
  - Action: use arg‑based spawn or `simple-git`; slugify branch names; robust cleanup.

## 4) Under‑the‑Hood Pipeline (Fastlane Only)

Surface:
- `graphyn` → prompt for query → pipeline
- `graphyn "<query>"` → pipeline

Pipeline (implicit):
1. Preflight (doctor‑lite): check `claude`, `git`, cwd perms; pre‑warm; load config.
2. Repo context: analyze; write CONTEXT.md.
3. Plan: `graph-builder` produces DAG; write PLAN.md.
4. Execute (parallel up to N):
   - Create worktree/branch per node; enrich prompt with predecessor outputs.
   - Call `ClaudeCodeWrapper.executeQuery()`; stream events.
   - Save node I/O; auto‑commit with `[agent]` prefix.
5. Progress & sync: maintain PROGRESS.json; write events.ndjson.
6. Optional PR aggregation; cleanup worktrees; persist artifacts.

## 5) ESLint Policy (Cross‑Repo; exclude @desktop for now)

Goal: Consistent TS/JS rules across repos. Desktop kept CamelCase (Swift), future Electron migration will align later.

Actions (@code immediate):
- Add TypeScript ESLint config (extends recommended), import/order, no secret logging, safe shell usage.
- Naming conventions: variables/functions snake_case or lowerCamelCase; classes/interfaces PascalCase. If class identifiers should not leak (e.g., GraphNeuralSystem), expose factory functions (e.g., `create_graph_orchestrator`) and discourage direct class usage at call sites.
- Enforce: no direct `exec("git ...")` strings; use arg arrays or libraries.

Rollout:
- Create shared eslint config package for all repos (except @desktop now).
- Apply via `eslint.config.mjs` or flat config, repo‑specific overrides.

## 6) Implementation Plan (Minimal Churn)

Phase 0 – Hardening (2–3 days)
- Consolidate API client to `src/api/client.ts`; migrate imports; deprecate/remove `src/api-client.ts`.
- Remove header dumps; mask Authorization; reduce noisy logs.
- Replace shell string git commands with arg‑based spawn or `simple-git`; slugify branches.

Phase 1 – Orchestrator wiring (3–5 days)
- Fastlane routes: ensure `graphyn` and `graphyn "query"` both call `orchestrateCommand()`.
- Inside `orchestrateCommand`, invoke `GraphNeuralSystem`/`GraphFlowEngine` execution path.
- Replace all direct `spawn('claude')` with `ClaudeCodeWrapper.executeQuery()`.

Phase 2 – Artifacts & Sync (2–3 days)
- Guarantee write‑through: `.graphyn/graph-memory/<runId>/{PLAN.md, CONTEXT.md, PROGRESS.json}` + per‑node I/O.
- Add `state/runs/<runId>/events.ndjson` stream writer; compact live dashboard.

Phase 3 – Deep Research hooks (3–5 days)
- Optional MCP detections: Perplexity/GitHub/Figma Dev Mode; add enhancer hooks.
- Fallbacks: local git intelligence; direct Figma API (existing).

Phase 4 – ESLint rollout (1–2 days)
- Add TS ESLint flat config to @code; fix critical violations (naming, imports, shell safety).
- Prepare shared config for other repos; exclude @desktop (Swift) initially.

## 7) Acceptance Criteria

- Fastlane only: users run `graphyn` or `graphyn "<query>"`; no new commands are required.
- End‑to‑end run (<30s standard path) on medium repo:
  - Writes PLAN.md, CONTEXT.md, PROGRESS.json under session folder.
  - Emits events.ndjson with node/graph events.
  - Executes up to 6 nodes in parallel; safe commits on per‑node branches.
  - Optional PR created when GH token present.
- Deep research mode (when MCPs available) adds research artifacts to PLAN; otherwise falls back gracefully.
- ESLint enforced in @code (CI fails on violations of core rules).

## 8) Risks & Mitigations

- Tool availability variance (MCPs/Backyard):
  - Mitigation: best‑effort enhancers; robust offline defaults.

- Token/context limits:
  - Mitigation: CONTEXT.md trimming (top dirs/files/deps), predecessor output summarization.

- Spawn reliability under concurrency:
  - Mitigation: single wrapper path; per‑node timeouts; bounded parallelism; retries for idempotent steps.

- Git conflicts / dirty tree:
  - Mitigation: worktrees per node; refuse start if working tree dirty; cleanup on failure.

- Secret leakage in logs:
  - Mitigation: mask Authorization; reduce debug header logs; redact sensitive values.

## 9) Testing Strategy

- Unit: graph-builder agent selection and dep rules; git automation (branch slugify, failure paths); API client error handling.
- Integration: a sample repo run verifies artifacts, parallel nodes, commit creation, and deterministic progress file.
- Manual: “Google OAuth for Next.js” scenario validates deep research hooks, design context enrichment, and end PR content.

## 10) Naming & Style Note

If class identifiers like `GraphNeuralSystem` should not appear in calling code, expose factory helpers (e.g., `create_graph_orchestrator()`) and prefer function‑level APIs at call sites. Enforce via ESLint ban‑list or import‑alias rules to prevent direct class usage outside orchestrator internals.

## 11) Open Questions

- Do we gate PR creation behind config only, or also infer from CI context?
- Preferred default parallelism for typical laptops (6 vs 8)?
- Which MCPs to prioritize in docs examples (Perplexity, GitHub, Figma Dev Mode)?

---

This plan prioritizes reuse of existing modules, removes duplication in Claude/process handling, adds reliable artifacts for traceability and desktop sync, and introduces ESLint consistency across repos (excluding @desktop for now). It keeps the user experience minimal (fastlane only) while delivering the deep research orchestration described in the user story.

