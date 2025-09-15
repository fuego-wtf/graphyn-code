#!/usr/bin/env node
/**
 * Test script to verify Claude Code SDK streaming fixes
 */

import { QueryUnderstandingEngine } from './dist/orchestrator/QueryUnderstandingEngine.js';
import { UniversalTaskDecomposer } from './dist/orchestrator/UniversalTaskDecomposer.js';

async function testQueryUnderstanding() {
  console.log('\n🧪 Testing Query Understanding Engine...\n');
  
  const engine = new QueryUnderstandingEngine();
  
  const testQueries = [
    'hello',
    'what is 2 + 2?',
    'create a Python hello world script',
    'how are you doing?'
  ];
  
  for (const query of testQueries) {
    try {
      console.log(`Query: "${query}"`);
      const start = Date.now();
      
      const result = await engine.understandQuery(query, process.cwd());
      
      const duration = Date.now() - start;
      console.log(`✅ Result (${duration}ms):`, {
        type: result.queryType,
        intent: result.intent,
        confidence: result.confidence,
        requiresPlanning: result.requiresTaskPlanning
      });
      console.log(`   Reasoning: ${result.reasoning}\n`);
      
    } catch (error) {
      console.error(`❌ Failed: ${error.message}\n`);
    }
  }
}

async function testTaskDecomposition() {
  console.log('\n🧪 Testing Universal Task Decomposer...\n');
  
  const decomposer = new UniversalTaskDecomposer();
  
  const testQuery = 'create a simple Node.js REST API';
  
  try {
    console.log(`Query: "${testQuery}"`);
    const start = Date.now();
    
    const graph = await decomposer.decomposeQuery(testQuery);
    
    const duration = Date.now() - start;
    console.log(`✅ Result (${duration}ms):`);
    console.log(`   Tasks: ${graph.nodes.length}`);
    console.log(`   Estimated time: ${graph.totalEstimatedTimeMinutes} minutes`);
    console.log(`   Max concurrency: ${graph.maxConcurrency}`);
    console.log(`   Parallelizable: ${graph.parallelizable}\n`);
    
    // Show first few tasks
    graph.nodes.slice(0, 3).forEach((task, i) => {
      console.log(`   Task ${i + 1}: ${task.title} (${task.assignedAgent})`);
    });
    
  } catch (error) {
    console.error(`❌ Failed: ${error.message}`);
  }
}

async function main() {
  console.log('🚀 Testing Claude Code SDK streaming fixes...');
  
  try {
    await testQueryUnderstanding();
    await testTaskDecomposition();
    
    console.log('\n✨ All tests completed!');
    
  } catch (error) {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  }
}

main();
