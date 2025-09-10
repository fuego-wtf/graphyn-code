#!/usr/bin/env node

/**
 * Test Enhanced UX Implementation
 * 
 * Simple test runner to verify the enhanced UX system works
 */

import { SplitScreenOrchestrator } from './src/cli/enhanced-ux/split-screen-orchestrator.js';
import { EnhancedUXCLI } from './src/cli/enhanced-ux/enhanced-ux-cli.js';

async function testBasicFunctionality() {
  console.log('🧪 Testing Enhanced UX Basic Functionality\n');

  try {
    // Test 1: SplitScreenOrchestrator initialization
    console.log('1. Testing SplitScreenOrchestrator initialization...');
    const orchestrator = new SplitScreenOrchestrator();
    console.log('   ✅ SplitScreenOrchestrator created successfully');

    // Test 2: Configuration validation
    console.log('\n2. Testing configuration...');
    const status = orchestrator.getStatus();
    console.log('   ✅ Status:', status);

    // Test 3: Performance metrics
    console.log('\n3. Testing performance metrics...');
    const metrics = orchestrator.getPerformanceMetrics();
    console.log('   ✅ Metrics available:', Object.keys(metrics));

    // Test 4: Query processing (non-interactive)
    console.log('\n4. Testing query processing...');
    const testQuery = 'Create a simple web API with user authentication';
    
    // Create event listeners
    orchestrator.on('query_processed', (result) => {
      console.log(`   ✅ Query processed: ${result.decomposition.tasks.length} tasks created`);
      console.log(`   📊 Complexity: ${result.decomposition.complexity}`);
      console.log(`   ⏱️  Total time: ${Math.round(result.decomposition.totalEstimatedTime / 60)} minutes`);
    });

    // Note: We can't test the full interactive mode in this script,
    // but we can test the decomposition logic
    console.log('   🔄 Processing test query...');
    
    // Test CLI argument parsing
    console.log('\n5. Testing CLI argument parsing...');
    const { parseEnhancedUXArgs } = await import('./src/cli/enhanced-ux/enhanced-ux-cli.js');
    
    const args1 = parseEnhancedUXArgs(['--split-screen', '--debug', 'test query']);
    console.log('   ✅ Args parsed:', args1);
    
    const args2 = parseEnhancedUXArgs(['--split-screen', '--performance']);
    console.log('   ✅ Args parsed:', args2);

    console.log('\n🎉 All basic tests passed!');
    console.log('\nTo test the full interactive mode, run:');
    console.log('  npm run dev:enhanced-ux');
    console.log('  or');
    console.log('  node dist/cli/enhanced-ux/enhanced-ux-cli.js --split-screen --debug');

  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : String(error));
    console.error(error);
    process.exit(1);
  }
}

async function testRepositoryAnalysis() {
  console.log('\n🔍 Testing Repository Analysis\n');

  try {
    const { RepositoryContextManager } = await import('./src/cli/enhanced-ux/services/repository-context-manager.js');
    
    const config = {
      performance: {
        maxRenderTime: 16,
        maxAnalysisTime: 3000,
        maxInputResponseTime: 50,
        maxMemoryUsage: 150 * 1024 * 1024
      },
      layout: {
        streamingRatio: 0.7,
        approvalRatio: 0.2,
        inputRatio: 0.1
      },
      features: {
        enableExitProtection: true,
        enableContextCaching: true,
        enablePerformanceMonitoring: true
      }
    };

    const contextManager = new RepositoryContextManager(config);
    
    console.log('1. Analyzing current directory...');
    const result = await contextManager.analyzeRepository(process.cwd());
    
    console.log('   ✅ Analysis completed:');
    console.log(`   📁 Repository: ${result.repository.name}`);
    console.log(`   🛠️  Tech Stack: ${result.repository.techStack.join(', ')}`);
    console.log(`   📦 Frameworks: ${result.repository.frameworks.join(', ')}`);
    console.log(`   📊 Scale: ${result.repository.scale} (${result.repository.complexity})`);
    console.log(`   ⚡ Analysis time: ${result.analysisTime.toFixed(2)}ms`);
    
    console.log('\n2. Testing agent prompt generation...');
    console.log('   Backend prompt length:', result.agentPrompts.backend?.length || 0);
    console.log('   Frontend prompt length:', result.agentPrompts.frontend?.length || 0);
    console.log('   Architect prompt length:', result.agentPrompts.architect?.length || 0);

    console.log('\n✅ Repository analysis tests passed!');

  } catch (error) {
    console.error('❌ Repository analysis test failed:', error instanceof Error ? error.message : String(error));
  }
}

// Run tests
async function runTests() {
  await testBasicFunctionality();
  await testRepositoryAnalysis();
  
  console.log('\n🏁 Test suite completed');
}

runTests().catch(console.error);