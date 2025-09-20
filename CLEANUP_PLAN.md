# 🧹 Repo Cleanup Plan

## Files to DELETE (80% of current repo)

### 1. Demo Pollution
```bash
rm demo-*.ts
rm hello*.py  
rm minimal_streaming_test.js
rm debug_streaming.js
rm fixed-claude-streaming.mjs
rm -rf examples/
```

### 2. NASA TUI Files
```bash
rm -rf src/tui/
rm -rf tests/tui/
rm docs/tui-components.md
rm TODO.md  # 20KB of TUI planning nonsense
```

### 3. Duplicate Files
```bash
rm src/orchestrator/MultiAgentOrchestrator.ts  # Keep the root one
rm .eslintrc.json  # Keep .eslintrc.cjs
rm README-*.md     # Keep main README.md only
rm -rf .claude/agents_backup/  # Identical to .claude/agents/
```

### 4. Archive Pollution
```bash
rm -rf archive/                    # 3 different abandoned architectures
rm -rf docs/archive/
rm CLAUDE*.md                      # 5 different design docs
rm HUMAN_IN_LOOP_DESIGN.md
rm SYSTEM_ARCHITECTURE.md
rm fix-claude-connectivity.md
```

### 5. Abandoned Features
```bash
rm -rf src/clyde/                  # Abandoned chat interface
rm -rf src/claude-*                # Multiple SDK wrappers
rm src/api-client.ts
rm src/auth.ts
rm docker-compose-cli.yml
rm openapitools.json
```

### 6. Script Pollution  
```bash
rm scripts/completion.bash
rm scripts/create-agents.sh
rm scripts/generate-sdk.js
rm scripts/graphyn                 # Keep the npm bin instead
rm scripts/graphyn-functions.sh
rm scripts/install.sh
rm scripts/postinstall.js
rm scripts/test-package.sh
rm scripts/validate-package.cjs
```

## Files to KEEP (The Gold)

### Core Orchestration (Your Innovation)
```
✅ src/MultiAgentOrchestrator.ts
✅ src/agents/BackendAgent.ts
✅ src/agents/SecurityAgent.ts  
✅ src/agents/BaseAgent.ts
```

### MCP Integration (Your Competitive Advantage)  
```
✅ src/mcp/server-registry.ts
✅ src/mcp/server-installer.ts
✅ src/mcp/server-discovery.ts
✅ src/mcp/bridge-implementation.ts
✅ src/services/mcp-config-generator.ts
```

### Essential Infrastructure
```
✅ scripts/dev.sh
✅ scripts/stop.sh
✅ package.json
✅ README.md (updated)
✅ .gitignore
✅ .claude/agents/ (project agents)
✅ bin/graphyn.js (CLI entry)
```

### Useful Tests
```
✅ tests/orchestrator.test.ts
✅ tests/agents/BackendAgent.test.ts
✅ tests/mcp/server-discovery.test.ts
```

## RESULT: 200+ files → 20 files

### Before: 47 documentation files, 9 demos, 3 architectures
### After: 1 README, working code

### Before: 5 different MultiAgentOrchestrator implementations  
### After: 1 that actually works

### Before: TUI framework for 2-minute scripts
### After: Clear console output showing real results

## Your Real Innovation

Stop hiding your actual innovations behind demo pollution:

1. **MCP Auto-Discovery** - Automatically detects React/PostgreSQL/Docker and installs relevant MCP servers
2. **Intelligent Configuration** - Generates .claude/settings.json based on project context
3. **Subprocess Stability** - Solved the Claude CLI hanging issue with exec() approach
4. **Parallel Agent Coordination** - Manages dependencies between specialized agents

These are **genuine competitive advantages**. The TUI is just distraction.

## Next Steps

1. Run cleanup script
2. Update README to focus on actual value  
3. Test that core orchestration still works
4. Ship the clean version

**Less is more. Ship the innovation, not the complexity.**