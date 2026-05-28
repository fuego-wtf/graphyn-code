/**
 * Stub for @anthropic-ai/claude-code SDK.
 *
 * @anthropic-ai/claude-code v2.x is a CLI binary package with no JS entry
 * point. This stub replaces it under Bun/vitest so tests that indirectly
 * invoke loadClaudeCodeSdk() resolve successfully.
 *
 * The stub `query` function returns a synthetic success result message so
 * unit tests that exercise AgentOrchestrator.executeQuery() (which calls
 * ClaudeCodeClient.executeQueryStream → loadClaudeCodeSdk → query) see a
 * successful SDK response without hitting the network or needing a real
 * ANTHROPIC_API_KEY.
 *
 * Integration tests that require live Claude Code SDK responses are marked
 * .skip in tests/integration/agent-orchestration.test.ts.
 */

export async function* query(_input: unknown): AsyncIterable<any> {
  // Emit a synthetic init event
  yield {
    type: 'system',
    subtype: 'init',
    session_id: 'stub-session-test',
    message: 'Stub SDK session initialized'
  };
  // Emit a synthetic result
  yield {
    type: 'result',
    subtype: 'success',
    result: 'Stub Claude response from test environment',
    duration_ms: 1,
    total_cost_usd: 0,
    usage: {
      input_tokens: 1,
      output_tokens: 1,
      cache_read_input_tokens: 0
    },
    num_turns: 1
  };
}

// Named export used by some older SDK consumers
export default { query };
