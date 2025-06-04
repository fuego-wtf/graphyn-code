# Graphyn Code Development Learnings

## Claude Code Terminal Integration (January 2025)

### The Problem
Claude Code CLI uses Ink (React for terminal UIs) which requires raw mode access to process.stdin. This creates conflicts when:

1. **Piping input**: `claude < file.txt` fails with "Raw mode is not supported" 
2. **Child process spawning**: Spawning Claude from another Node.js process fails
3. **Terminal sharing**: When parent process has stdin in raw mode (like inquirer)

### Failed Approaches
1. ❌ `spawn('claude', [content], { stdio: 'inherit' })` - Terminal conflict
2. ❌ `spawn('claude', [], { stdio: ['pipe'] })` + writing to stdin - Raw mode error
3. ❌ Terminal cleanup before spawning - Still conflicts
4. ❌ Detached processes - Claude still can't access terminal properly
5. ❌ Using osascript to open new terminal - Piping still fails

### Root Cause
Claude Code is designed to be launched as the primary process with full terminal control. It cannot properly initialize when:
- Input comes from a pipe/redirect
- It's a child of another process
- Terminal is already in use

### Working Solution
Claude Code works best when:
1. Launched directly by the user
2. Given prompts as command line arguments: `claude "prompt text"`
3. Using `/read` command after launch: `/read filepath`

### Implementation Strategy
For graphyn integration:
1. Save agent context + query to temp file
2. For direct command execution: Try `claude "full content"`
3. For interactive mode: Show instructions to run in new terminal
4. Provide fallback `/read` command option

### Key Learnings
- Terminal UI frameworks (Ink) have strict requirements
- Child process terminal sharing is complex
- Sometimes the best UX is clear instructions, not automation
- Always provide multiple fallback options

### Future Considerations
- Monitor Claude Code updates for potential stdin support
- Consider creating a Claude Code extension/plugin instead
- Explore using Claude's API when available