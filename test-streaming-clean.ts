#!/usr/bin/env node
/**
 * Real-Time CLI Streaming Test Suite
 * 
 * Comprehensive tests to validate that Claude CLI streaming works correctly
 * and provides true real-time responses without delays or hanging issues.
 */

import { claudeHeadlessStreamingService } from './src/services/ClaudeHeadlessStreamingService.js';
import { performance } from 'perf_hooks';

interface TestMetrics {
  testName: string;
  startTime: number;
  firstChunkTime?: number;
  completionTime?: number;
  totalChunks: number;
  totalBytes: number;
  success: boolean;
  error?: string;
  latency: {
    timeToFirstChunk?: number;
    totalDuration?: number;
  };
}

class StreamingTestSuite {
  private testResults: TestMetrics[] = [];
  
  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Real-Time CLI Streaming Tests\n');
    
    try {
      // Health check first
      await this.testHealthCheck();
      
      // Basic streaming tests
      await this.testBasicStreaming();
      await this.testGreetingStreaming();
      
      // Session management tests
      await this.testSessionCreation();
      
      // Performance test
      await this.testStreamingLatency();
      
      // Generate test report
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    }
  }
  
  async testHealthCheck(): Promise<void> {
    console.log('🔍 Testing Health Check...');
    
    const startTime = performance.now();
    
    try {
      const health = await claudeHeadlessStreamingService.healthCheck();
      const completionTime = performance.now();
      
      if (health.available) {
        console.log(`✅ Health check passed`);
        console.log(`   Version: ${health.version}`);
        console.log(`   Pool size: ${health.poolSize}`);
        console.log(`   Duration: ${(completionTime - startTime).toFixed(2)}ms\n`);
      } else {
        throw new Error('Claude CLI not available');
      }
      
    } catch (error) {
      console.log(`❌ Health check failed: ${error}\n`);
      throw error;
    }
  }
  
  async testBasicStreaming(): Promise<void> {
    console.log('🧪 Testing Basic Streaming...');
    
    const metrics: TestMetrics = {
      testName: 'Basic Streaming',
      startTime: performance.now(),
      totalChunks: 0,
      totalBytes: 0,
      success: false,
      latency: {}
    };
    
    try {
      await claudeHeadlessStreamingService.streamQuery(
        "Say hello and explain what you can help with in 2 sentences.",
        {
          timeout: 10000,
          verbose: false
        },
        // onChunk
        (chunk: string) => {
          if (!metrics.firstChunkTime) {
            metrics.firstChunkTime = performance.now();
            metrics.latency.timeToFirstChunk = metrics.firstChunkTime - metrics.startTime;
            process.stdout.write('📥 First chunk received! Streaming: ');
          }
          
          process.stdout.write(chunk);
          metrics.totalChunks++;
          metrics.totalBytes += chunk.length;
        },
        // onComplete
        (fullResponse: string) => {
          metrics.completionTime = performance.now();
          metrics.latency.totalDuration = metrics.completionTime - metrics.startTime;
          metrics.success = true;
          
          console.log('\n✅ Basic streaming test completed');
          console.log(`   Response length: ${fullResponse.length} characters`);
          console.log(`   Chunks received: ${metrics.totalChunks}`);
          console.log(`   Time to first chunk: ${metrics.latency.timeToFirstChunk?.toFixed(2)}ms`);
          console.log(`   Total duration: ${metrics.latency.totalDuration?.toFixed(2)}ms\n`);
        }
      );
      
      this.testResults.push(metrics);
      
    } catch (error) {
      metrics.error = error instanceof Error ? error.message : String(error);
      this.testResults.push(metrics);
      
      console.log(`❌ Basic streaming test failed: ${metrics.error}\n`);
      throw error;
    }
  }
  
  async testGreetingStreaming(): Promise<void> {
    console.log('👋 Testing Greeting Streaming...');
    
    const metrics: TestMetrics = {
      testName: 'Greeting Streaming',
      startTime: performance.now(),
      totalChunks: 0,
      totalBytes: 0,
      success: false,
      latency: {}
    };
    
    try {
      await claudeHeadlessStreamingService.streamGreeting(
        "Hi there! What can you help me with?",
        {
          timeout: 10000
        },
        (chunk: string) => {
          if (!metrics.firstChunkTime) {
            metrics.firstChunkTime = performance.now();
            metrics.latency.timeToFirstChunk = metrics.firstChunkTime - metrics.startTime;
            process.stdout.write('📥 Greeting response: ');
          }
          
          process.stdout.write(chunk);
          metrics.totalChunks++;
          metrics.totalBytes += chunk.length;
        },
        (fullResponse: string) => {
          metrics.completionTime = performance.now();
          metrics.latency.totalDuration = metrics.completionTime - metrics.startTime;
          metrics.success = true;
          
          console.log('\n✅ Greeting streaming test completed');
          console.log(`   Time to first chunk: ${metrics.latency.timeToFirstChunk?.toFixed(2)}ms`);
          console.log(`   Total duration: ${metrics.latency.totalDuration?.toFixed(2)}ms\n`);
        }
      );
      
      this.testResults.push(metrics);
      
    } catch (error) {
      metrics.error = error instanceof Error ? error.message : String(error);
      this.testResults.push(metrics);
      
      console.log(`❌ Greeting streaming test failed: ${metrics.error}\n`);
    }
  }
  
  async testSessionCreation(): Promise<void> {
    console.log('🔐 Testing Session Creation...');
    
    try {
      const sessionId = await claudeHeadlessStreamingService.createSession();
      console.log(`✅ Session created: ${sessionId}`);
      
      const activeSessions = claudeHeadlessStreamingService.getActiveSessions();
      console.log(`   Active sessions: ${activeSessions.length}`);
      
      // Clean up
      await claudeHeadlessStreamingService.destroySession(sessionId);
      console.log(`   Session destroyed: ${sessionId}\n`);
      
    } catch (error) {
      console.log(`❌ Session creation test failed: ${error}\n`);
    }
  }
  
  async testStreamingLatency(): Promise<void> {
    console.log('⏱️ Testing Streaming Latency...');
    
    const measurements: number[] = [];
    const iterations = 3;
    
    for (let i = 1; i <= iterations; i++) {
      console.log(`   Measurement ${i}/${iterations}...`);
      
      const startTime = performance.now();
      let firstChunkTime: number | undefined;
      
      await claudeHeadlessStreamingService.streamQuery(
        "Say 'Hello' in one word.",
        { timeout: 5000 },
        (chunk) => {
          if (!firstChunkTime) {
            firstChunkTime = performance.now();
            measurements.push(firstChunkTime - startTime);
          }
        },
        () => {}
      );
    }
    
    const avgLatency = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const minLatency = Math.min(...measurements);
    const maxLatency = Math.max(...measurements);
    
    console.log(`\n✅ Latency test completed`);
    console.log(`   Average latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`   Min latency: ${minLatency.toFixed(2)}ms`);
    console.log(`   Max latency: ${maxLatency.toFixed(2)}ms`);
    console.log(`   Target: < 2000ms (${avgLatency < 2000 ? '✅' : '❌'})\n`);
  }
  
  generateReport(): void {
    console.log('📊 Test Results Summary');
    console.log('='.repeat(50));
    
    const totalTests = this.testResults.length;
    const successfulTests = this.testResults.filter(t => t.success).length;
    const failedTests = totalTests - successfulTests;
    
    console.log(`Total tests: ${totalTests}`);
    console.log(`Successful: ${successfulTests} (${((successfulTests / totalTests) * 100).toFixed(1)}%)`);
    console.log(`Failed: ${failedTests} (${((failedTests / totalTests) * 100).toFixed(1)}%)`);
    console.log();
    
    // Latency analysis
    const successfulLatencies = this.testResults
      .filter(t => t.success && t.latency.timeToFirstChunk)
      .map(t => t.latency.timeToFirstChunk!);
    
    if (successfulLatencies.length > 0) {
      const avgLatency = successfulLatencies.reduce((a, b) => a + b, 0) / successfulLatencies.length;
      console.log(`Average time to first chunk: ${avgLatency.toFixed(2)}ms`);
      console.log(`Real-time threshold (< 2000ms): ${avgLatency < 2000 ? '✅ PASSED' : '❌ FAILED'}`);
    }
    
    console.log();
    
    // Individual test results
    this.testResults.forEach((test) => {
      const status = test.success ? '✅' : '❌';
      const latency = test.latency.timeToFirstChunk?.toFixed(2) || 'N/A';
      const duration = test.latency.totalDuration?.toFixed(2) || 'N/A';
      
      console.log(`${status} ${test.testName}`);
      console.log(`   First chunk: ${latency}ms, Total: ${duration}ms, Chunks: ${test.totalChunks}`);
      
      if (test.error) {
        console.log(`   Error: ${test.error}`);
      }
    });
    
    console.log();
    
    if (failedTests === 0) {
      console.log('🎉 All tests passed! Real-time streaming is working correctly.');
    } else {
      console.log(`⚠️ ${failedTests} test(s) failed. Please review the issues above.`);
    }
  }
}

// Main execution
async function main() {
  const testSuite = new StreamingTestSuite();
  
  try {
    await testSuite.runAllTests();
    process.exit(0);
  } catch (error) {
    console.error('Test suite execution failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
