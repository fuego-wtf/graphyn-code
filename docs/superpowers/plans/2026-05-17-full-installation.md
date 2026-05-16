# Graphyn Code Full Installation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install all dependencies, fix build errors, build the project, set up environment, and verify the CLI runs correctly.

**Architecture:** Sequential pipeline: install deps → commit pending fixes → TypeScript build → env setup → CLI smoke test → full package test. Each stage produces a verifiable artifact.

**Tech Stack:** Bun 1.3+, TypeScript 5, Node.js 16+, Vitest, Ink (React for CLI)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` | Read only | Dependency manifest |
| `tsconfig.json` | Already modified | TypeScript compiler config (pending commit) |
| `src/mcp/bridge-implementation.ts` | Already modified | ESM import path fixes (pending commit) |
| `src/types/globals.d.ts` | Read only | Global type declarations |
| `src/types/claude-code.d.ts` | Read only | Claude Code SDK types |
| `.env.example` | Read only | Environment variable template |
| `bin/graphyn.js` | Read only | CLI entry point (requires `dist/`) |
| `scripts/test-package.sh` | Read only | Package installation test |
| `scripts/validate-package.cjs` | Read only | Package structure validator |
| `dist/**` | Created by build | Compiled JavaScript output |
| `node_modules/**` | Created by install | Dependencies |
| `.env` | Created by setup | Local environment config |

---

### Task 1: Install Dependencies

**Files:**
- `node_modules/**` — Created by bun install
- `bun.lock` — Updated by bun install

- [ ] **Step 1: Install all dependencies**

Run from workspace root:
```bash
bun install
```

Expected: All 30+ dependencies resolved and installed, including:
- Runtime: @anthropic-ai/claude-code, @modelcontextprotocol/sdk, ink, react, commander, chalk, zod, zustand, etc.
- Dev: typescript, ts-node, @types/*

- [ ] **Step 2: Verify installation**

```bash
ls node_modules/@anthropic-ai/claude-code && ls node_modules/ink && ls node_modules/react
```

Expected: All three directories exist with content.

- [ ] **Step 3: Verify bun version compatibility**

```bash
bun --version
```

Expected: 1.3.x (matches packageManager field in package.json: bun@1.3.9)

---

### Task 2: Commit Pending Changes

**Files:**
- `tsconfig.json` — Change `outDir` from `"./dist"` to `"dist"` and `rootDir` from `"./src"` to `"src"`
- `src/mcp/bridge-implementation.ts` — Fix ESM imports to include `.js` extension

- [ ] **Step 1: Review pending changes**

```bash
git diff
```

Expected: Two files modified:
1. `tsconfig.json` — path prefix removal (cosmetic, both work)
2. `src/mcp/bridge-implementation.ts` — adding `.js` extensions to dynamic imports (required for ESM)

- [ ] **Step 2: Stage and commit**

```bash
git add tsconfig.json src/mcp/bridge-implementation.ts
git commit -m "fix: ESM import paths and tsconfig output directories"
```

Expected: Clean commit, `git status` shows clean working tree.

---

### Task 3: TypeScript Build

**Files:**
- `dist/**` — Created by `bun run build`
- `src/types/globals.d.ts` — Referenced by compiler for global types
- `src/types/claude-code.d.ts` — Referenced by compiler for Claude SDK types

- [ ] **Step 1: Run TypeScript build**

```bash
bun run build
```

This runs `tsc` with config:
- target: ES2022, module: ES2022
- outDir: dist, rootDir: src
- strict: true, jsx: react
- Excludes: node_modules, dist, tests

- [ ] **Step 2: If build succeeds, verify output**

```bash
ls dist/index.js && ls dist/orchestrator/UltimateOrchestrator.js && ls dist/commands/env.js
```

Expected: All three compiled files exist.

- [ ] **Step 3: If build fails, capture errors**

If `tsc` reports errors, capture the full output:
```bash
bun run build 2>&1 | tee /tmp/build-errors.txt
```

Common error categories to expect based on README documentation:
- **PROCESS-001**: Missing `Task` global — should be resolved by `src/types/globals.d.ts` and `src/types/claude-code.d.ts`
- **PROCESS-009**: Missing methods in `dynamic-engine.ts` — may need stub implementations
- **PROCESS-010**: Agent/Thread interface mismatches — should be resolved by `EnhancedAgent`/`EnhancedThread` in globals.d.ts

Report exact error count and file list. Do NOT guess fixes — return errors for analysis.

---

### Task 4: Environment Setup

**Files:**
- `.env` — Created from `.env.example`
- `.env.example` — Read only, template

- [ ] **Step 1: Copy .env.example to .env**

```bash
cp .env.example .env
```

- [ ] **Step 2: Verify .env file exists and has placeholders**

```bash
cat .env
```

Expected: File exists with placeholder values for:
- `GRAPHYN_API_URL=https://api.graphyn.xyz/api/v1`
- `GRAPHYN_API_KEY=gph_sk_your_api_key_here`
- `GRAPHYN_OAUTH_PORT=8989`
- `FIGMA_CLIENT_ID`, `FIGMA_CLIENT_SECRET` (placeholders)

Note: This project runs in offline mode per CLAUDE.md — auth is disabled. Placeholder values are acceptable for installation verification.

---

### Task 5: CLI Smoke Test

**Files:**
- `bin/graphyn.js` — Entry point
- `dist/index.js` — Unified CLI (compiled)
- `dist/orchestrator/UltimateOrchestrator.js` — Orchestrator (compiled)

- [ ] **Step 1: Test version command**

```bash
node bin/graphyn.js --version
```

Expected: Prints version string (e.g., `0.1.32`)

- [ ] **Step 2: Test help command**

```bash
node bin/graphyn.js --help
```

Expected: Prints comprehensive help message with commands, agent commands, options, MCP integration sections.

- [ ] **Step 3: Test env command**

```bash
node bin/graphyn.js env list
```

Expected: Lists configured environment targets.

- [ ] **Step 4: Test doctor command**

```bash
node bin/graphyn.js doctor
```

Expected: Runs diagnostics, reports system status. May warn about missing API key (expected in offline mode).

- [ ] **Step 5: Test interactive mode starts (then exit)**

```bash
echo "" | timeout 3 node bin/graphyn.js 2>&1 || true
```

Expected: Starts interactive mode, shows "Graphyn Code - AI Development Orchestrator" banner, then times out cleanly.

---

### Task 6: Package Validation Test

**Files:**
- `scripts/validate-package.cjs` — Package structure validator
- `scripts/test-package.sh` — Full package installation test

- [ ] **Step 1: Run package validation**

```bash
node scripts/validate-package.cjs
```

Expected: Passes with no errors. Validates package.json structure, required files, bin entry, etc.

- [ ] **Step 2: Run full package test (optional, takes longer)**

```bash
bun run test:package
```

This script:
1. Validates package structure
2. Creates a .tgz package
3. Installs in isolated /tmp directory
4. Tests CLI commands in isolation
5. Cleans up

Expected: All tests pass, "All tests passed!" message.

---

### Task 7: Unit Tests (if build succeeds)

**Files:**
- `vitest.config.ts` — Test configuration
- `tests/**/*.{test,spec}.ts` — 19 test files across unit/integration/contract

- [ ] **Step 1: Run unit tests**

```bash
npx vitest run --reporter=verbose 2>&1 | head -100
```

Expected: Tests execute. Some may fail if they depend on external services — report pass/fail counts.

---

## Self-Review

1. **Spec coverage:** All installation steps covered — deps, build, env, smoke test, package test, unit tests.
2. **Placeholder scan:** No TBD/TODO placeholders in plan. All steps have concrete commands and expected output.
3. **Type consistency:** File paths consistent throughout. Commands reference actual files that exist in the repo.

## Execution Order

Tasks must run sequentially: 1 → 2 → 3 → 4 → 5 → 6 → 7
- Task 3 depends on Task 1 (needs node_modules for type checking)
- Task 5 depends on Task 3 (needs dist/ folder)
- Task 6 depends on Task 3 (needs built package)
- Task 7 depends on Task 3 (needs compiled types)

## Blockers to Watch For

1. **TypeScript build errors** — Most likely blocker. README documents 22 historical errors. Report exact count.
2. **Missing Claude Code SDK types** — Should be resolved by globals.d.ts, but verify.
3. **Ink/React JSX compilation** — tsconfig has `jsx: "react"`, ensure no JSX files in src/ break compilation.
4. **ESM module resolution** — The `.js` extension fix in bridge-implementation.ts suggests other files may need the same fix.
