# Agent Collaboration Policy

This CLI tool follows the **Backbone Plan v1** doctrine for V1 launch readiness.

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

## Reference

- **Source**: `docs/desktop/backbone-plan-v1.md`
- **Status**: Frozen baseline — changes require explicit approval
