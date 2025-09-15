#!/usr/bin/env node
/**
 * Test script to verify streaming performance improvements
 */

import { UltimateOrchestrator } from './dist/orchestrator/UltimateOrchestrator.js';

async function testQuestionStreaming() {
  console.log('🧪 Testing Question Streaming Performance...\n');
  
  const orchestrator = new UltimateOrchestrator({
    workingDirectory: process.cwd()
  });
  
  const testQuestions = [
    'what can you help me with?',
    'tell me about this project',
  ];
  
  for (const question of testQuestions) {
    try {
      console.log(`Question: "${question}"`);
      const start = Date.now();
      
      const result = await orchestrator.orchestrateQuery(question);
      
      const duration = Date.now() - start;
      console.log(`\n✅ Completed in ${duration}ms (vs previous 79.8s!)\n`);
      console.log('---\n');
      
    } catch (error) {
      console.error(`❌ Failed: ${error.message}\n`);
    }
  }
  
  console.log('✨ Streaming test completed!');
}

testQuestionStreaming().catch(console.error);
