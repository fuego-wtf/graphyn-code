# CLI Streaming Fix Implementation

## Problem Analysis
User reported 10+ second freezes when running `graphyn "hey there"`:
- Static output blocks instead of character streaming
- Long frozen periods at "Starting query analysis..." 
- No real-time progress indicators
- Total execution time >50 seconds with no streaming

## Root Cause Investigation
Found **two critical blocking points**:

### 1. Wrong Execution Method in CLI Orchestrator
**File**: `src/cli-orchestrator.ts:232`
**Issue**: `handleSplitScreenQuery` was calling blocking `executeQuery()` instead of streaming `executeQueryStream()`
```typescript
// ❌ BEFORE: Blocking call
const result = await realTimeExecutor.executeQuery(query, { 
  workingDirectory: process.cwd() 
});

// ✅ AFTER: Streaming call  
for await (const event of realTimeExecutor.executeQueryStream(query, {
  workingDirectory: process.cwd()
})) {
  // Real-time event processing
}
```

### 2. Slow Claude-based Routing Analysis  
**File**: `src/orchestrator/AgentOrchestrator.ts:117`
**Issue**: Every query triggered slow Claude API call for routing analysis, causing 10+ second freeze
```typescript
// ❌ BEFORE: Always uses slow Claude routing
const claudeAnalysis = await this.getClaudeRoutingRecommendation(...);

// ✅ AFTER: Fast path for simple queries
const isComplexQuery = query.length > 100 || /* complexity checks */;
if (!isComplexQuery) {
  return keywordAnalysis; // Instant routing
}
```

## Fixes Implemented

### Fix 1: Streaming CLI Execution Path
- **Modified**: `handleSplitScreenQuery()` in `cli-orchestrator.ts`
- **Change**: Replaced blocking `executeQuery` with streaming `executeQueryStream`  
- **Result**: Real-time character-by-character output with 5ms delays
- **User Experience**: Immediate visual feedback, no frozen states

### Fix 2: Fast Routing for Simple Queries  
- **Modified**: `analyzeTask()` in `AgentOrchestrator.ts`
- **Change**: Added fast path that bypasses Claude routing for simple queries
- **Criteria**: Queries <100 chars without complex keywords use instant keyword matching
- **Result**: "hey there" (9 chars) now routes instantly instead of 10+ second Claude call

## Expected Performance Improvement

### Before Fix:
- Time to first output: 10+ seconds
- Routing analysis: 10+ seconds (Claude API call)
- Character streaming: None (block updates only)
- Total freeze time: 40+ seconds
- User experience: Static, unresponsive

### After Fix:
- Time to first output: <1 second
- Routing analysis: <100ms (keyword matching) 
- Character streaming: 5ms per character
- Total freeze time: <3 seconds maximum
- User experience: Live, responsive, real-time feedback

## Testing
- **Simple Query Test**: `graphyn "hey there"` should trigger fast path
- **Character Streaming**: Output should appear character-by-character with 5ms delays
- **Progress Indicators**: Real-time status updates during execution  
- **No Freezes**: Maximum gap between outputs <3 seconds

## Files Changed
1. `/src/cli-orchestrator.ts` - Line 232: Fixed blocking execution call
2. `/src/orchestrator/AgentOrchestrator.ts` - Line 117: Added fast routing path

## Rollback Plan
If issues arise, revert both files to previous versions:
- Revert streaming call back to blocking `executeQuery`
- Revert routing to always use Claude analysis

The streaming architecture remains intact - only the execution path and routing logic were optimized.