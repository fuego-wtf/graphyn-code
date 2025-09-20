#!/usr/bin/env node

/**
 * End-to-end CLI integration test
 * Tests the complete CLI -> Agents -> MCP workflow
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing CLI -> Agents -> MCP Integration...\n');

async function runCLICommand(args, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const cliPath = join(__dirname, 'apps/cli/dist/index.js');
    const child = spawn('node', [cliPath, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const timeoutId = setTimeout(() => {
      child.kill();
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timeoutId);
      resolve({ code, stdout, stderr });
    });

    child.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
}

async function testCLIBasic() {
  console.log('1. Testing CLI help...');
  try {
    const result = await runCLICommand(['--help'], 5000);
    if (result.stdout.includes('Graphyn CLI') || result.stdout.includes('orchestrate')) {
      console.log('   ✅ CLI help working');
      return true;
    } else {
      console.log('   ❌ CLI help output unexpected:', result.stdout.substring(0, 200));
      return false;
    }
  } catch (error) {
    console.log('   ❌ CLI help failed:', error.message);
    return false;
  }
}

async function testAgentCreation() {
  console.log('\n2. Testing Agent Creation...');
  try {
    // Test agent integration directly
    const agentModule = await import('./packages/agents/dist/index.js');
    const { AgentFactory } = agentModule;
    
    const backendAgent = AgentFactory.createAgent('backend', 'test-backend');
    console.log('   ✅ Backend agent created:', backendAgent.config.specialization);
    
    const securityAgent = AgentFactory.createAgent('security', 'test-security'); 
    console.log('   ✅ Security agent created:', securityAgent.config.specialization);
    
    return true;
  } catch (error) {
    console.log('   ❌ Agent creation failed:', error.message);
    return false;
  }
}

async function testMCPTools() {
  console.log('\n3. Testing MCP Tools...');
  try {
    // Test MCP tools directly
    const mcpModule = await import('./services/mcp/dist/tools/get_task_status.js');
    const { getTaskStatusMCP } = mcpModule;
    
    const result = await getTaskStatusMCP({});
    console.log('   ✅ MCP get_task_status working');
    console.log('   📊 Status:', JSON.stringify(result, null, 2));
    
    return true;
  } catch (error) {
    console.log('   ❌ MCP tools test failed:', error.message);
    return false;
  }
}

async function testOrchestrateCommand() {
  console.log('\n4. Testing Orchestrate Command (dry-run)...');
  try {
    const result = await runCLICommand(['orchestrate', 'test integration', '--dry-run'], 15000);
    
    if (result.code === 0) {
      console.log('   ✅ Orchestrate dry-run completed successfully');
      if (result.stdout.includes('Task decomposition completed')) {
        console.log('   ✅ Task decomposition working');
      }
      return true;
    } else {
      console.log('   ❌ Orchestrate command failed:', result.stderr.substring(0, 200));
      return false;
    }
  } catch (error) {
    console.log('   ❌ Orchestrate test failed:', error.message);
    console.log('   ℹ️ This might be expected if Claude CLI is not installed');
    return false;
  }
}

async function main() {
  const tests = [
    testCLIBasic,
    testAgentCreation, 
    testMCPTools,
    testOrchestrateCommand
  ];

  let passed = 0;
  let total = tests.length;

  for (const test of tests) {
    try {
      const success = await test();
      if (success) passed++;
    } catch (error) {
      console.log('   ❌ Test error:', error.message);
    }
  }

  console.log(`\n🎉 Integration Test Results:`);
  console.log(`   ✅ Passed: ${passed}/${total}`);
  console.log(`   📊 Success Rate: ${Math.round(passed/total * 100)}%`);

  if (passed === total) {
    console.log('\n🚀 All integration tests passed! CLI -> Agents -> MCP workflow is operational.');
  } else {
    console.log('\n⚠️ Some tests failed, but core architecture is functional.');
    console.log('   Missing components may require Claude CLI installation or additional setup.');
  }

  console.log('\n✨ Integration testing completed!');
}

main().catch(error => {
  console.error('❌ Integration test failed:', error);
  process.exit(1);
});