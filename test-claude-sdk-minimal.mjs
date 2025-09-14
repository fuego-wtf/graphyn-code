#!/usr/bin/env node

/**
 * MINIMAL TEST SCRIPT FOR CLAUDE CODE SDK
 *
 * This tests the Claude CLI directly to identify the root cause
 * of why our Claude Code SDK wrapper times out after 30 seconds
 */

import { spawn } from 'child_process';

console.log('🔍 TESTING CLAUDE CLI DIRECTLY...\n');

// Test 1: Check if Claude CLI is available
async function testClaudeCLI() {
  console.log('🔧 Test 1: Check Claude CLI availability');

  return new Promise((resolve) => {
    const which = process.platform === 'win32' ? 'where' : 'which';
    const child = spawn(which, ['claude'], { stdio: 'pipe' });

    let output = '';
    child.stdout?.on('data', (data) => {
      output += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0 && output.trim()) {
        console.log('✅ Claude CLI found at:', output.trim().split('\n')[0]);
        resolve({ found: true, path: output.trim().split('\n')[0] });
      } else {
        console.log('❌ Claude CLI not found in PATH');
        resolve({ found: false });
      }
    });

    child.on('error', (error) => {
      console.log('❌ Error checking Claude CLI:', error.message);
      resolve({ found: false, error: error.message });
    });
  });
}

// Test 2: Try Claude CLI version
async function testClaudeVersion(claudePath) {
  console.log('\n⚡ Test 2: Check Claude CLI version');

  return new Promise((resolve) => {
    const child = spawn(claudePath, ['--version'], { stdio: 'pipe' });

    let output = '';
    let error = '';

    child.stdout?.on('data', (data) => {
      output += data.toString();
    });

    child.stderr?.on('data', (data) => {
      error += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Claude CLI version:', output.trim());
        resolve({ success: true, version: output.trim() });
      } else {
        console.log('❌ Claude CLI version failed:', error || output);
        resolve({ success: false, error: error || output });
      }
    });

    child.on('error', (err) => {
      console.log('❌ Error running Claude CLI:', err.message);
      resolve({ success: false, error: err.message });
    });
  });
}

// Test 3: Test Claude authentication status
async function testClaudeAuth(claudePath) {
  console.log('\n🔐 Test 3: Check Claude authentication');

  return new Promise((resolve) => {
    const child = spawn(claudePath, ['auth', 'status'], { stdio: 'pipe' });

    let output = '';
    let error = '';

    child.stdout?.on('data', (data) => {
      output += data.toString();
    });

    child.stderr?.on('data', (data) => {
      error += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Claude auth status:', output.trim());
        resolve({ authenticated: true, status: output.trim() });
      } else {
        console.log('❌ Claude auth check failed:', error || output);
        resolve({ authenticated: false, error: error || output });
      }
    });

    child.on('error', (err) => {
      console.log('❌ Error checking auth:', err.message);
      resolve({ authenticated: false, error: err.message });
    });
  });
}

// Test 4: Test minimal Claude execution with timeout monitoring
async function testClaudeExecution(claudePath) {
  console.log('\n🚀 Test 4: Minimal Claude CLI execution (10s timeout)');
  console.log('   This test reproduces our SDK timeout issue...');

  return new Promise((resolve) => {
    const testPrompt = 'Say "Hello from test" and exit.';
    console.log('📝 Sending prompt:', testPrompt);

    const child = spawn(claudePath, ['-p', testPrompt], {
      stdio: 'pipe'
    });

    let output = '';
    let error = '';
    let firstOutputReceived = false;
    let startTime = Date.now();

    child.stdout?.on('data', (data) => {
      if (!firstOutputReceived) {
        const timeToFirst = Date.now() - startTime;
        console.log(`⚡ FIRST OUTPUT received after ${timeToFirst}ms`);
        firstOutputReceived = true;
      }

      const chunk = data.toString();
      output += chunk;
      console.log('📤 Claude output:', chunk.trim());
    });

    child.stderr?.on('data', (data) => {
      const chunk = data.toString();
      error += chunk;
      console.log('🚨 Claude error:', chunk.trim());
    });

    child.on('close', (code) => {
      const totalTime = Date.now() - startTime;
      console.log(`🏁 Claude process ended after ${totalTime}ms with code ${code}`);
      resolve({
        success: code === 0,
        hasOutput: output.length > 0,
        firstOutputReceived,
        totalTime,
        output: output.trim(),
        error: error.trim(),
        exitCode: code
      });
    });

    child.on('error', (err) => {
      const totalTime = Date.now() - startTime;
      console.log('💥 Claude process error after', totalTime + 'ms:', err.message);
      resolve({
        success: false,
        hasOutput: false,
        firstOutputReceived,
        totalTime,
        error: err.message,
        processError: true
      });
    });

    // Monitor for timeout (like our SDK does)
    const timeoutHandle = setTimeout(() => {
      if (!firstOutputReceived) {
        console.log('🚨 TIMEOUT: No output received within 10 seconds');
        console.log('   This is exactly what our SDK experiences!');

        child.kill('SIGTERM');
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 2000);

        resolve({
          success: false,
          hasOutput: false,
          firstOutputReceived: false,
          totalTime: 10000,
          error: 'Timeout - no output received within 10 seconds',
          timeout: true
        });
      }
    }, 10000); // 10 second timeout

    // Clear timeout if we get output
    child.stdout?.on('data', () => {
      if (firstOutputReceived && timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    });
  });
}

// Main test runner
async function runTests() {
  console.log('🏃‍♂️ Starting Claude CLI diagnostic tests...\n');

  // Test 1: CLI availability
  const cliTest = await testClaudeCLI();

  if (!cliTest.found) {
    console.log('\n🚨 ROOT CAUSE FOUND: Claude CLI not installed!');
    console.log('To fix: Install Claude CLI from https://claude.ai/cli');
    return;
  }

  // Test 2: Version check
  const versionTest = await testClaudeVersion(cliTest.path);

  if (!versionTest.success) {
    console.log('\n🚨 ROOT CAUSE FOUND: Claude CLI broken/corrupted!');
    console.log('To fix: Reinstall Claude CLI');
    return;
  }

  // Test 3: Authentication
  const authTest = await testClaudeAuth(cliTest.path);

  if (!authTest.authenticated) {
    console.log('\n🚨 POTENTIAL ROOT CAUSE: Authentication issues!');
    console.log('To fix: Run `claude auth login`');
    // Continue with execution test anyway
  }

  // Test 4: Execution test (this should reveal the timeout issue)
  const execTest = await testClaudeExecution(cliTest.path);

  // Results analysis
  console.log('\n📊 DIAGNOSTIC RESULTS:');
  console.log('='.repeat(60));
  console.log('Claude CLI Found:', cliTest.found ? '✅' : '❌');
  console.log('Version Check:', versionTest.success ? '✅' : '❌');
  console.log('Authentication:', authTest.authenticated ? '✅' : '❌');
  console.log('Execution Test:', execTest.success ? '✅' : '❌');

  if (!execTest.success) {
    console.log('\n🔥 EXECUTION FAILURE ANALYSIS:');
    console.log('Has Output:', execTest.hasOutput ? '✅' : '❌');
    console.log('First Output Received:', execTest.firstOutputReceived ? '✅' : '❌');
    console.log('Total Time:', execTest.totalTime + 'ms');

    if (execTest.timeout) {
      console.log('\n🎯 ROOT CAUSE IDENTIFIED: CLAUDE CLI HANGS!');
      console.log('   - Claude CLI never produces output');
      console.log('   - This causes our SDK to timeout waiting for first response');
      console.log('   - The 30s timeout in our code is correct - Claude just hangs');
    }

    if (!execTest.firstOutputReceived) {
      console.log('\n🔍 POSSIBLE CAUSES:');
      console.log('   1. Authentication expired/invalid');
      console.log('   2. Network connectivity issues');
      console.log('   3. Claude API service down');
      console.log('   4. Proxy/firewall blocking requests');
      console.log('   5. Rate limiting/quota exceeded');
    }
  } else {
    console.log('\n✅ Claude CLI working correctly!');
    console.log('   This suggests our SDK wrapper has a bug, not Claude CLI');
  }

  console.log('\n🛠️ RECOMMENDED FIXES:');
  if (!authTest.authenticated) {
    console.log('1. Run: claude auth login');
  }
  if (execTest.timeout) {
    console.log('2. Check network connectivity to claude.ai');
    console.log('3. Check for proxy settings blocking HTTPS');
    console.log('4. Try: claude auth status');
    console.log('5. If auth shows logged in, check API quotas/limits');
  }

  console.log('\n✅ Diagnostic complete. Root cause analysis above.');
}

// Run the tests
runTests().catch(error => {
  console.log('💥 Test execution failed:', error.message);
  process.exit(1);
});