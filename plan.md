1. S0. Lock the 140-step delivery spec from delivery.md into a machine-readable flow
Goal: Convert delivery.md into an authoritative YAML flow that a CLI runner can execute, resume, and validate.

Actions:
- Parse delivery.md into flows/delivery.flow.yaml with explicit fields: id, title, description, inputs, preconditions, commands, validations, artifacts, rollback, timeout, retries, concurrency_group, idempotency_key, tags.
- Introduce a small schema flows/schema.json for validation.
- Add a generator script tools/flowgen.ts that compiles delivery.md into YAML and cross-links sections with anchors.
- Create a test harness tests/flow/validate.spec.ts that checks: 140 steps present, no duplicate ids, all steps have validations, timeouts, and rollback defined.

Acceptance:
- Running: pnpm graphyn flow validate passes.
- flows/delivery.flow.yaml contains exactly 140 ordered steps and round-trips back to a markdown report via pnpm graphyn flow render.
2. S1. Repository audit, baseline branch, and contribution gates
Actions:
- Create branch feature/production-upgrade and CODEOWNERS for critical dirs.
- Add ADRs: docs/adr/0001-140-flow-as-source-of-truth.md, 0002-sqlite-wal2.md, 0003-mcp-transport.md, 0004-agent-isolation.md.
- Enforce conventional commits and changesets for versioning; enable commitlint and pre-commit hooks.
- Pin Node 20 LTS, pnpm 9, and Go 1.22 if needed for helpers. Add .tool-versions or .nvmrc.

Acceptance:
- CI runs lint, typecheck, unit, integration smoke on PR.
- All modules build reproducibly on macOS and Linux.
3. S2. Align repo to TO-BE file tree and scaffold foundations
Create core packages and apps per TO-BE:

Proposed tree:
- apps/cli graphyn CLI runner and TUI
- apps/mission-control web dashboard
- services/mcp MCP server adapter
- services/coordinator orchestration and scheduler
- packages/db SQLite client, migrations, and event bus
- packages/core domain models, types, state machines
- packages/agents Claude Code headless harness and factory
- packages/figma Figma OAuth plus API client
- packages/session sessions, transcripts, archive and replay
- packages/obs logging, metrics, tracing, redaction
- packages/security crypto, keyring, sandbox policies
- packages/workspace filesystem, repo mapping, isolation
- packages/flow 140-step compiler and runner
- packages/ui shared UI components and design tokens
- packages/config config loader, schema, and feature flags

Scaffold with generators and placeholder exports, wire pnpm workspaces and TS project references.
4. S3. Toolchain, quality, and build baseline
Actions:
- TypeScript strict mode, path aliases, build pipelines with tsup or esbuild.
- ESLint with security plugins, Zod for runtime validation, Vitest for tests.
- Introduce OpenTelemetry SDK for Node with OTLP exporter guarded by feature flags.
- Add dotenv-safe and configuration precedence: env vars, workspace config, user config in home, project config.

Acceptance:
- pnpm -r build and pnpm -r test succeed; coverage threshold 80 percent min in core packages.
5. S4. ~/.graphyn multi-tenant data architecture and config schema
Design directory layout without using angle brackets:

- Home root: ~/.graphyn
  - config.yaml global defaults
  - identities/{user_id}/ profile.json, keys/, secrets/, sessions/
  - workspaces/{workspace_id}/ repo_map.json, tasks/, artifacts/, transcripts/
  - cache/, logs/, tmp/
  - policies/ sandbox profiles and allowlists

Config model:
- Zod schema with fields: identity.active, storage.encryption, figma.scopes, db.path, wal2.enabled, mcp.port, dashboard.port, feature_flags.
- Master key strategy: Prefer OS keyring on macOS Keychain, else env GRAPHYN_MASTER_KEY, fallback to pass-compatible file-based keyring. AES-GCM streaming for file encryption and libsodium sealed box for tokens.

Acceptance:
- pnpm graphyn init home creates structure with permissions 700 for private dirs and emits config.yaml with sane defaults.
6. S5. Identity, keys, and secret vault adapter
Actions:
- Implement identity create, list, activate. Generate Ed25519 and X25519 keys, store in identities/{id}/keys with age-compatible format for interoperability.
- Secrets vault: pluggable adapters for macOS Keychain, Linux libsecret, and file-keystore. Uniform API: put, get, del with transparent encryption at rest.
- Token records: figma, git, anthropic, custom. Store metadata and rotation timestamps.

Acceptance:
- pnpm graphyn identity create produces an identity and verifies encryption by attempting secret round-trip.
7. S6. Session lifecycle and workspace organization
Lifecycle:
- session states: new, active, paused, archived, replayed.
- workspace mapping to repos: workspaces/{workspace_id}/ linked to a project path; maintain repo_map.json and .graphynignore.

Artifacts:
- transcripts/{session_id}.ndjson append-only event stream
- tasks/{task_id}/ with plan.json, inputs.json, outputs/, logs/
- artifacts/{artifact_id}/ binary or packaged outputs with metadata

Acceptance:
- pnpm graphyn session start --workspace path creates a session and directories, and emits transcript headers.
8. S7. SQLite 3.46 with WAL2 and connection strategy
Actions:
- Use better-sqlite3 compiled against SQLite 3.46 with WAL2 enabled. Verify with PRAGMA journal_mode=wal2 and PRAGMA wal_checkpoint=TRUNCATE where appropriate.
- Connection policy: one write connection per process, N read connections; busy_timeout 5000 ms; foreign_keys ON; synchronous NORMAL; mmap_size tuned for platform.
- Ship migrations via drizzle-kit or kysely; migrations table and version gate.

Acceptance:
- pnpm graphyn db check verifies WAL2 and schema; concurrent read and write smoke tests pass.
9. S8. Orchestration schema for tasks, runs, MCP calls, sessions, and telemetry
Tables:
- sessions, tasks, task_edges, runs, run_steps, mcp_calls, events, agents, agent_heartbeats, processes, resources, artifacts, secrets_index, audits, errors.

Indices and constraints defined for ACID semantics; use CHECK constraints for enumerations. Provide views for dashboard: v_live_agents, v_task_progress, v_errors_recent.

Acceptance:
- Migration applies cleanly and seed script loads demo rows; explain plans for hot queries are index-backed.
10. S9. DB event bus and change notification fanout
Approach:
- Primary: triggers append to events table with row-level details; consumers tail events using since_id checkpoints.
- WAL2: optional low-latency feed using an extension process that reads wal2 frames and publishes to internal event bus; fallback to polling with 50 ms jitter.

Fanout:
- Internal Node EventEmitter
- SSE endpoint for dashboard: GET /events
- MCP transport: broadcast state changes to subscribed clients

Acceptance:
- Under load, event end-to-end latency p99 less than 200 ms; no missed events in a chaos test dropping 10 percent packets.
11. S10. MCP server scaffolding and transport contracts
Actions:
- Implement services/mcp with OpenRPC-like description for tools.
- Auth via identity tokens bound to sessions; per-tool ACLs tied to feature flags.
- Heartbeat and discovery: mcp.listTools, mcp.subscribeEvents, mcp.health.

Acceptance:
- mcp ping and listTools succeed; unauthenticated requests are rejected with structured errors.
12. S11. MCP tool catalog for orchestration primitives
Tools:
- fs.read, fs.write, fs.patch, fs.search with policy enforcement
- git.status, git.commit, git.diff, git.apply
- db.query, db.taskGet, db.taskUpdate, db.eventsSince
- shell.exec with sandbox profile and resource caps
- agents.spawn, agents.kill, agents.stats
- figma.auth, figma.fetchFile, figma.fetchNodes
- flow.stepStart, flow.stepEnd, flow.annotate

Acceptance:
- Tool registry introspects tools and exports JSON for client codegen; each tool has input and output schema.
13. S12. Task coordinator and state machine with MCP and WAL2 integration
Design:
- Deterministic state machine for task lifecycle: planned, ready, running, blocked, failed, succeeded, canceled.
- Coordinator watches DB events and schedules runs respecting dependencies in task_edges.
- Retries with exponential backoff; dead-letter queue for exhausted retries.

Acceptance:
- Simulated tasks with dependencies execute in correct order across process restarts; idempotency maintained using idempotency_key per step.
14. S13. Claude Code headless agent harness
Actions:
- Implement an Agent API: plan, act, reflect, toolcall, commit.
- Backing LLM: Anthropic Messages API configured for code-intensive prompts. Provide tool adapters mapped to MCP tools.
- Editor patch protocol: unified patch format with conflict detection and three-way merge.

Acceptance:
- agents can propose and apply code changes to a temp workspace and pass validation hooks before commit.
15. S14. Agent specialization engine and factory
Specializations:
- Orchestrator, Codegen, Refactor, Test, DevOps, UI-Design, Data-Engineer at minimum six specializations.
- Dynamic specialization selection using dependency resolution based on task tags and repository signals.
- Prompt templates with system, developer, and repository context; include safety rails and policy injection.

Acceptance:
- Factory spins the right specialization and produces consistent outputs across three different repo archetypes.
16. S15. Agent isolation, resource governance, and sandboxing
Isolation:
- Per-agent process via child_process.spawn with pty; working dir under workspaces/{workspace_id}/agents/{agent_id}.
- Resource caps: on macOS use taskpolicy to lower priority; on Linux use cgroups v2; global limits configurable.
- Network policy: default deny, explicit allowlist for necessary hosts like api.anthropic.com and api.figma.com.
- File access: enforce allowlist via a policy layer and path resolution guard.

Acceptance:
- Adversarial tests cannot read outside workspace or contact disallowed endpoints; runaway agents are killed and auto-restarted within SLA.
17. S16. Agent grid, pool management, and health checks
Actions:
- Pool with warm agents and cold start paths; automatic scaling based on queue depth.
- Health checks: liveness, readiness, and periodic stats published to DB resources and agents tables.
- PID tracking and soft-drain for shutdown.

Acceptance:
- Mission control displays live grid; scaling up and down leaves no orphan processes.
18. S17. Figma OAuth 2 with PKCE, local callback, and token storage
Actions:
- Implement OAuth device or local callback loop: start local server on loopback, open browser, complete code flow.
- Store access and refresh tokens via secrets vault; scopes configured in config.yaml.
- Token refresh scheduler and revocation handler.

Acceptance:
- pnpm graphyn figma login completes and token is persisted encrypted; refresh logic verified with forced expiration.
19. S18. Figma API integration and design graph extraction
Actions:
- Endpoints: files, nodes, images, styles, components.
- Build a normalized design graph: nodes with type, geometry, text, styles, constraints, tokens.
- Caching with ETag; delta pulls to reduce API usage.

Acceptance:
- Given a public prototype id, extraction produces a design graph snapshot in artifacts and an index persisted to DB.
20. S19. Component generation pipeline with i18n and accessibility checks
Pipeline:
- Map design graph to a UI component schema with props, variants, design tokens.
- Use the Codegen agent to emit components for target stacks: React plus Tailwind, React Native, and optional Vue.
- i18n extraction for text nodes; a11y linting: color contrast, ARIA roles.

Acceptance:
- Generated components pass lint, typecheck, and unit snapshots; visual diffs stable across reruns.
21. S20. Real-time transparency backend: events, metrics, and process tree
Server:
- services/coordinator exposes SSE and WebSocket feeds: events, processes, tasks, mcpCalls, resources.
- Build in-process process tree collector mapping PIDs to agents and tasks; poll CPU and memory.
- Integrate with OpenTelemetry metrics; export to Prometheus format and OTLP if enabled.

Acceptance:
- p95 update interval less than 250 ms; dashboard and TUI show synchronized data streams.
22. S21. Transparency dashboard frontend and TUI
Web:
- apps/mission-control with Next.js or Vite React; subscribe to SSE; panels for agent grid, task gantt, MCP call timeline, resource charts, error console.
- Command palette to invoke actions via REST or MCP.

TUI:
- apps/cli includes a curses-like view graphyn top to display live processes, agents, and logs with filters.

Acceptance:
- Both views render identical core data; interactive commands work end-to-end.
23. S22. Mission control interactive commands
Commands:
- start task, pause task, retry task, scale agent pool, kill agent, tail logs, export session, annotate step.
- RBAC tied to identities; audit entries for each command.

Acceptance:
- Command audit trails appear in audits table and transcripts; unauthorized commands are blocked.
24. S23. Session persistence, archiving, and export
Format:
- transcripts in newline-delimited JSON with cryptographic hash chain for tamper evidence.
- Archive bundle graphyn-session.tgz containing transcript, artifacts manifest, repo diffs, and metadata; optional encryption.

Acceptance:
- pnpm graphyn session archive produces bundle; import validates hash chain and schema.
25. S24. Replay engine with deterministic tool rehydration
Approach:
- Rehydrate from transcript; stub external calls using recorded I-O; allow non-deterministic blocks with markers and sandboxed re-execution.
- Snapshots: optional filesystem snapshots at step boundaries for fast-forward.

Acceptance:
- Replay reproduces final artifacts byte-for-byte for deterministic flows and within tolerance for non-deterministic steps; diff report generated.
26. S25. Structured logging, redaction, and diagnostics
Logging:
- Pino-based structured logs with redaction rules for secrets and PII; log contexts include session, task, agent ids.
- Diagnostics command graphyn doctor running health checks: permissions, wal2, network reachability, token status.

Acceptance:
- Secrets never appear in logs; doctor outputs actionable remediation steps.
27. S26. Error handling, retries, and recovery playbooks
Mechanics:
- Standard error taxonomy: user_error, transient, permanent, policy_violation.
- Automatic retries for transient errors with jitter; circuit breakers for flapping agents; DLQ inspection tools.

Playbooks:
- docs/runbooks covering top incidents: DB locked, token revoked, runaway process, wal2 corruption.

Acceptance:
- Fault injection tests demonstrate correct classification and recovery without human intervention for common cases.
28. S27. Security hardening and multitenancy enforcement
Measures:
- Threat model document; dependency scanning; supply-chain controls with integrity pinned registries.
- Per-identity isolation of data and ACLs across MCP tools; secrets scoping.
- Optional network egress proxy with logging.

Acceptance:
- Static analysis and secret scans clean; multi-identity tests show no cross-tenant leakage.
29. S28. Encode the 140-step CLI workflow precisely and map to features
Deliver:
- flows/delivery.flow.yaml with sections grouped into 14 segments of 10 steps each:
  - 001-010 bootstrap and environment
  - 011-020 home and identity
  - 021-030 sessions and workspaces
  - 031-040 database and wal2
  - 041-050 db events and telemetry
  - 051-060 mcp server and tools
  - 061-070 coordinator and scheduler
  - 071-080 agents harness and specialization
  - 081-090 isolation and pool
  - 091-100 figma auth and extraction
  - 101-110 component generation
  - 111-120 dashboard and mission control
  - 121-130 persistence, archive, and replay
  - 131-140 testing, packaging, and release

Acceptance:
- CLI can run any contiguous or selective subset and resume idempotently using stored checkpoints.
30. S29. CLI runner and recorder with idempotency and resume
Features:
- graphyn run --flow flows/delivery.flow.yaml --from 1 --to 140 with dry-run and continue-on-error modes.
- Step recorder writes run_steps, artifacts, and transcript entries; idempotency_key enforced per step.
- Context passing between steps via a scoped KV store persisted in DB.

Acceptance:
- Kill and resume mid-run without redoing completed steps; recorder correlates all outputs to tasks and sessions.
31. S30. End-to-end Figma to components golden path
Scenario:
- Start session, authenticate Figma, extract design, generate components, run tests, commit to repo, produce artifacts, show dashboard updates.

Acceptance:
- One command graphyn demo figma-to-code executes the golden path and produces a reproducible artifact set and a session archive.
32. S31. Testing suite: unit, integration, e2e, chaos, and performance
Coverage:
- Unit tests in all packages; integration tests for MCP tools and DB; E2E tests driving CLI flow for at least 3 repo templates.
- Chaos: kill agents and DB writer mid-run; WAL2 corruption simulation; network partition for dashboards.
- Performance: scale to 50 concurrent tasks and 20 agents on a dev machine; measure latencies and CPU usage.

Acceptance:
- Dashboards remain responsive; SLOs documented with p95 and p99 targets met.
33. S32. Observability pipeline and system health SLOs
- Define SLOs: event latency, scheduler decision time, agent start time, dashboard refresh.
- Expose Prometheus /metrics and health endpoints; OTLP exporters toggle by config.
- Alerts in docs: when to page, what metrics to watch.

Acceptance:
- Synthetic monitors pass; SLO dashboards ready in mission control.
34. S33. Packaging, services, and release automation
Packaging:
- Distribute CLI via npm and Homebrew tap; produce binaries with pkg or nexe if required.
- Launch agents and coordinator as system services: systemd units for Linux, launchd plists for macOS.
- Release workflow: version bump via changesets, signed tags, artifacts uploaded.

Acceptance:
- Install guides for macOS and Linux validated; services start at boot; upgrade path is smooth.
35. S34. Documentation, runbooks, and final GA readiness
Docs:
- Developer onboarding, API references for MCP tools, configuration cookbook, security guidelines.
- Operator runbooks and troubleshooting charts; manual QA script for full 140-step journey.
- Compliance and licensing review with third-party notices.

Acceptance:
- Feature-by-feature parity check against the TO-BE matrix is complete; sign-off for GA with a dry-run release.
36. Annex A. Direct mapping of TO-BE features to plan steps and flow segments
- Core Orchestration: S7-S12, segments 031-070
- Agent Management: S13-S16, segments 071-090
- Process Transparency: S20-S22, S25, S32, segments 111-120
- Data Management: S4-S6, S23-S24, segments 011-030 and 121-130
- Figma Integration: S17-S19, segments 091-110
- Mission Control: S20-S22, segments 111-120
- Developer Experience and CLI: S2-S3, S28-S29, S30, segments 001-010 and 131-140
- Database and Storage: S7-S9, segments 031-050
- Error Handling: S26, segments spread where validations and rollback exist
- Security: S5, S15, S27, segments 011-020 and 071-090

This annex ensures traceability to the comparison table and delivery expectations.
37. Annex B. Minimal acceptance checklist per 140-step segment
For each 10-step segment, verify:
- All steps have rollback and validations defined.
- Idempotency keys and concurrency groups are set.
- Transcript entries emitted and linked to runs.
- Metrics and logs include step ids and segment id.
- Timeouts enforced; retries configured for transient errors.

This keeps the 140 processes clean, auditable, and resumable.