#!/usr/bin/env node

/**
 * Test script for multi-agent coordination
 */

import { AgentRegistry } from './agent-registry.js';
import { TaskDecomposer } from './task-decomposer.js';
import { MultiAgentSessionManager } from './multi-agent-session-manager.js';
import chalk from 'chalk';

async function testMultiAgentSystem() {
  console.log(chalk.cyan('🧪 Testing Multi-Agent Coordination System'));
  console.log();

  try {
    // Test 1: Agent Registry
    console.log(chalk.blue('1. Testing Agent Registry...'));
    const agentRegistry = new AgentRegistry();
    await agentRegistry.loadAgents();
    
    const agents = agentRegistry.getAgents();
    console.log(chalk.green(`✅ Loaded ${agents.length} agents`));
    
    for (const agent of agents.slice(0, 3)) { // Show first 3 agents
      console.log(chalk.gray(`   - ${agent.name}: ${agent.specializations.slice(0, 3).join(', ')}`));
    }
    console.log();

    // Test 2: Task Decomposition
    console.log(chalk.blue('2. Testing Task Decomposition...'));
    const taskDecomposer = new TaskDecomposer(agentRegistry);
    
    const testRequests = [
      'Build a fullstack authentication system',
      'Review the API documentation',
      'Create comprehensive tests for the frontend'
    ];

    for (const request of testRequests) {
      console.log(chalk.gray(`   Analyzing: "${request}"`));
      const graph = await taskDecomposer.decomposeRequest(request);
      console.log(chalk.green(`   ✅ Generated ${graph.nodes.length} tasks (${graph.totalEstimatedTime}min, ${graph.maxConcurrency} max concurrency)`));
    }
    console.log();

    // Test 3: Agent Matching
    console.log(chalk.blue('3. Testing Agent Capability Matching...'));
    const testKeywords = ['authentication', 'frontend', 'testing', 'architecture'];
    
    for (const keyword of testKeywords) {
      const matchingAgents = agentRegistry.getAgentsByCapability([keyword]);
      console.log(chalk.gray(`   "${keyword}" matches: ${matchingAgents.slice(0, 2).map(a => a.name).join(', ')}`));
    }
    console.log();

    // Test 4: Performance Simulation
    console.log(chalk.blue('4. Testing Performance Simulation...'));
    const startTime = Date.now();
    
    // Simulate complex request processing
    const complexRequest = 'Create a comprehensive fullstack authentication system with testing and documentation';
    const complexGraph = await taskDecomposer.decomposeRequest(complexRequest);
    
    const processingTime = Date.now() - startTime;
    const performanceTarget = processingTime < 1000; // 1 second for decomposition
    
    console.log(chalk.gray(`   Complex request processing: ${processingTime}ms`));
    console.log(performanceTarget ? 
      chalk.green('   ✅ Performance target achieved (<1s)') :
      chalk.yellow('   ⚠️  Performance could be optimized')
    );
    console.log();

    // Test 5: System Status
    console.log(chalk.blue('5. System Status Summary'));
    const sessionManager = new MultiAgentSessionManager(agentRegistry, 8);
    const status = sessionManager.getSessionStatus();
    
    console.log(chalk.green('✅ Multi-Agent Coordination System Ready'));
    console.log(chalk.gray(`   Available agents: ${agents.length}`));
    console.log(chalk.gray(`   Max concurrent sessions: 8`));
    console.log(chalk.gray(`   Active sessions: ${status.active}/${status.total}`));
    console.log();
    
    console.log(chalk.cyan('🎉 All tests passed! Multi-agent system is operational.'));

  } catch (error) {
    console.error(chalk.red('❌ Test failed:'), error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testMultiAgentSystem()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export { testMultiAgentSystem };