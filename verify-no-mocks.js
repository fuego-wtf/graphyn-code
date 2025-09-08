#!/usr/bin/env node

/**
 * Verify that AgentOrchestrator has NO mock code remaining
 */

import fs from 'fs/promises';

console.log('🔍 Verifying AgentOrchestrator contains NO mock responses...');

async function verifyNoMocks() {
  try {
    const orchestratorPath = './src/orchestrator/AgentOrchestrator.ts';
    const content = await fs.readFile(orchestratorPath, 'utf-8');
    
    // Check for any mock-related patterns (excluding "NO MOCKING" comment)
    const mockPatterns = [
      'generateAgentAnalysis',
      'generateAssistantAnalysis', 
      'generateArchitectAnalysis',
      'This is a mock',
      'This is a simulated',
      'simulated response',
      'fake response'
    ];
    
    // Check for problematic mock patterns (not just the "NO MOCKING" comment)
    const problematicMocks = [
      /mock(?!ing)/i,  // "mock" but not "mocking"
      /Mock(?!ing)/,   // "Mock" but not "Mocking" 
    ];
    
    let foundMocks = false;
    const foundPatterns = [];
    
    // Check string patterns
    mockPatterns.forEach(pattern => {
      if (content.includes(pattern)) {
        foundMocks = true;
        foundPatterns.push(pattern);
      }
    });
    
    // Check regex patterns
    problematicMocks.forEach(pattern => {
      if (pattern.test(content)) {
        foundMocks = true;
        foundPatterns.push(pattern.toString());
      }
    });
    
    if (foundMocks) {
      console.log('❌ MOCK CODE DETECTED:');
      foundPatterns.forEach(pattern => {
        console.log(`  - Found pattern: "${pattern}"`);
      });
    } else {
      console.log('✅ NO MOCK CODE FOUND - AgentOrchestrator uses only real Claude SDK');
    }
    
    // Check that real Claude SDK calls are present
    const realPatterns = [
      'claudeClient.executeQuery',
      'Use REAL Claude Code SDK',
      'NO MOCKING'
    ];
    
    let foundRealCalls = false;
    realPatterns.forEach(pattern => {
      if (content.includes(pattern)) {
        foundRealCalls = true;
        console.log(`✅ Found real SDK pattern: "${pattern}"`);
      }
    });
    
    if (!foundRealCalls) {
      console.log('❌ WARNING: No real Claude SDK calls detected');
    }
    
    console.log('\n📊 Summary:');
    console.log(`Mock code detected: ${foundMocks ? '❌ YES' : '✅ NO'}`);
    console.log(`Real SDK calls detected: ${foundRealCalls ? '✅ YES' : '❌ NO'}`);
    
    const isFixed = !foundMocks && foundRealCalls;
    console.log(`\nAgentOrchestrator fixed: ${isFixed ? '✅ YES' : '❌ NO'}`);
    
    return isFixed;
    
  } catch (error) {
    console.log('❌ Verification failed:', error.message);
    return false;
  }
}

const isFixed = await verifyNoMocks();
console.log(isFixed ? '\n🎉 SUCCESS: All mock code removed, real Claude SDK in use!' : '\n💥 FAILURE: Still contains mock code');
process.exit(isFixed ? 0 : 1);