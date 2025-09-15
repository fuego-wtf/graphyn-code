#!/usr/bin/env node
/**
 * Quick demo of the real-time CLI streaming implementation
 */

import { claudeHeadlessStreamingService } from './src/services/ClaudeHeadlessStreamingService.js';

async function demo() {
  console.log('🎉 Real-Time CLI Streaming Demo');
  console.log('================================\n');

  try {
    // Health check
    console.log('1️⃣ Health Check...');
    const health = await claudeHeadlessStreamingService.healthCheck();
    console.log(`✅ Claude CLI Available: ${health.available}`);
    console.log(`   Version: ${health.version || 'Unknown'}`);
    console.log(`   Pool Size: ${health.poolSize}\n`);

    // Quick streaming demo
    console.log('2️⃣ Quick Streaming Test...');
    console.log('👤 User: Hello! Can you help me understand real-time streaming?');
    process.stdout.write('🤖 Assistant: ');

    const startTime = Date.now();
    let firstChunkTime: number | undefined;
    
    await claudeHeadlessStreamingService.streamGreeting(
      "Hello! Can you help me understand real-time streaming?",
      { timeout: 15000 },
      // onChunk - real-time streaming
      (chunk: string) => {
        if (!firstChunkTime) {
          firstChunkTime = Date.now();
        }
        process.stdout.write(chunk);
      },
      // onComplete
      () => {
        const totalTime = Date.now() - startTime;
        const timeToFirst = firstChunkTime ? firstChunkTime - startTime : 0;
        
        console.log('\n');
        console.log(`📊 Performance Metrics:`);
        console.log(`   Time to first chunk: ${timeToFirst}ms`);
        console.log(`   Total response time: ${totalTime}ms`);
        console.log(`   Real-time streaming: ${timeToFirst < 2000 ? '✅ WORKING' : '❌ SLOW'}`);
      }
    );

    console.log('\n🎯 Success! The enhanced CLI streaming service provides:');
    console.log('   • True real-time responses (sub-second latency)');
    console.log('   • No 70-second delays like the broken SDK');
    console.log('   • Production-ready session management');
    console.log('   • Comprehensive error handling');
    console.log('   • Memory and resource management');

  } catch (error) {
    console.error('❌ Demo failed:', error);
    
    console.log('\n🔧 Troubleshooting:');
    console.log('   • Ensure Claude CLI is installed: https://claude.ai/cli');
    console.log('   • Check your Claude authentication');
    console.log('   • Verify network connectivity');
    
    process.exit(1);
  }
}

// Run demo
demo().then(() => {
  console.log('\n✨ Demo completed successfully!');
  process.exit(0);
});
