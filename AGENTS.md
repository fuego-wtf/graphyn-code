# Agent Collaboration Policy

This CLI tool follows the **Backbone Plan v1** doctrine for V1 launch readiness.

## Constitution Priority (Mandatory)

This agent doc inherits the workspace-root `docs/CONSTITUTION.md`. If a local
rule conflicts with the constitution, follow the stricter rule and report the
conflict.

Every code agent must preserve operator agency, tell runtime truth with
receipts, protect secrets and permissions, treat performance as a product
contract, and model agent/mode/lens/topology nodes as runtime artifacts with
provenance.

## Workspace policy inheritance (mandatory)

This doc also inherits the workspace Constitution's context stewardship rule:
load only what the next decision needs, keep active context compact, and move
durable state into governed docs, receipts, memory, loop files, or runtime
nodes. Treat gatekeeper/closure, delegated-auth, question-before-plan, retainer
lifecycle, and certified-vs-reported state as policy gates: do not bypass them
with local shortcuts, and attach receipts when a gate is satisfied.

## Core Principles

| Principle | Description |
|-----------|-------------|
| **Wiring-First** | No mock success states. Real backend paths only. Fail fast with clear errors. |
| **Source-Anchored Planning** | Plans reference actual files and code. No speculative architecture. |
| **Phase/Reporting Conventions** | All updates include: phase, current step, completed, remaining, blockers. |

## Execution Reporting Format

All progress updates must include:
1. **Backbone phase** (e.g., Phase 3A)
2. **Current step(s)**
3. **What was completed**
4. **What remains in this phase**
5. **Any blocker** (or "none")

## Environment Variable Management

This CLI includes an `env` command for managing registered workspace and compound `.env` files. Run from the workspace root:

```bash
# Build the CLI first
cd code && bun install && bun run build && cd ..

# Available commands
bun code/bin/graphyn.js env setup    # Copy .env.example → .env for registered env targets
bun code/bin/graphyn.js env check    # Audit .env files for placeholder values
bun code/bin/graphyn.js env list     # Show which services have env files configured
bun code/bin/graphyn.js env help     # Full usage guide
```

After `env setup`, decrypt real secrets from `.skills/fuegolabs-onboarding/secrets/*.env.enc` using the team passphrase (saved as "envault" in Bitwarden). The agent handles decryption automatically.

There is no global install. All commands run via `bun code/bin/graphyn.js` from the workspace root.

Implementation: `src/commands/env.ts`

## Reference

- **Source**: `docs/desktop/backbone-plan-v1.md`
- **Status**: Frozen baseline — changes require explicit approval
