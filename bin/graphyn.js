#!/usr/bin/env node
/**
 * Graphyn - Ultimate Orchestration Platform v10.0.0
 * Direct entry point that uses UltimateOrchestrator for all queries
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check for built UltimateOrchestrator
const builtPath = join(__dirname, '..', 'dist', 'orchestrator', 'UltimateOrchestrator.js');
const unifiedCliPath = join(__dirname, '..', 'dist', 'index.js');
const srcPath = join(__dirname, '..', 'src', 'orchestrator', 'UltimateOrchestrator.ts');

async function main() {
  const query = process.argv.slice(2).join(' ');
  const firstToken = process.argv[2];

  // Route deterministic `base` command through the unified CLI router.
  if (firstToken === 'base') {
    if (!existsSync(unifiedCliPath)) {
      console.error('❌ Graphyn CLI not built. Run: npm run build');
      process.exit(1);
    }

    try {
      const module = await import(unifiedCliPath);
      if (typeof module.main !== 'function') {
        console.error('❌ Unified CLI entrypoint missing exported main()');
        process.exit(1);
      }

      await module.main();
      return;
    } catch (error) {
      console.error('❌ Failed to execute base command:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  try {
    let UltimateOrchestrator;

    if (existsSync(builtPath)) {
      // Use built version
      const module = await import(builtPath);
      UltimateOrchestrator = module.UltimateOrchestrator;
    } else {
      console.error('❌ Ultimate Orchestrator not built. Run: npm run build');
      process.exit(1);
    }

    console.log('🚀 ULTIMATE ORCHESTRATION PLATFORM v10.0.0');
    console.log('═'.repeat(80));

    if (!query) {
      console.log('💡 Usage: graphyn "your natural language query"');
      console.log('📝 Example: graphyn "hello"');
      console.log('🎯 Performance Targets: <30s completion, <150MB memory, 99% reliability');
      process.exit(0);
    }

    console.log(`💡 Query: "${query}"`);
    console.log(`📁 Working Directory: ${process.cwd()}`);
    console.log('═'.repeat(80));
    console.log('');

    // Create and execute with Ultimate Orchestrator - FIXED: Use default timeout
    const orchestrator = new UltimateOrchestrator({
      workingDirectory: process.cwd(),
      maxParallelAgents: 8,
      // taskTimeoutMs: removed - let it use DEFAULT_TIMEOUT_MS (120s)
      enablePerformanceMonitoring: true
    });

    const result = await orchestrator.orchestrateQuery(query);

    // Display results
    console.log('');
    console.log('📊 ORCHESTRATION RESULTS');
    console.log('─'.repeat(50));
    console.log(`✅ Success: ${result.success}`);
    console.log(`⏱️  Total Time: ${result.totalTimeSeconds.toFixed(1)}s`);
    console.log(`✅ Tasks Completed: ${result.tasksCompleted}`);
    console.log(`❌ Tasks Failed: ${result.tasksFailed}`);
    console.log(`🤖 Agents Used: ${result.agentsUsed}`);

    if (result.performanceMetrics) {
      console.log('');
      console.log('🎯 PERFORMANCE SUMMARY');
      console.log('─'.repeat(50));
      console.log(`🧠 Memory Peak: ${result.performanceMetrics.memoryPeakMb.toFixed(1)}MB`);
      console.log(`🚀 Efficiency: ${(result.performanceMetrics.parallelEfficiency * 100).toFixed(1)}%`);
      console.log(`🎯 Target Met: ${result.performanceMetrics.targetTimeAchieved ? '✅' : '❌'}`);
    }

    console.log('');
    process.exit(result.success ? 0 : 1);

  } catch (error) {
    console.error('❌ Ultimate Orchestration failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main().catch(console.error);
