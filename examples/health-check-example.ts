#!/usr/bin/env tsx

/**
 * Health Check Example
 * 
 * Demonstrates how to use the HealthChecker for comprehensive system diagnostics
 * Run with: npm run tsx examples/health-check-example.ts
 */

import { HealthChecker } from '@graphyn/core';

async function main() {
  console.log('🔍 Graphyn System Health Check\n');

  const healthChecker = new HealthChecker();

  try {
    // Run comprehensive health check
    console.log('Running comprehensive system health check...');
    const health = await healthChecker.checkSystemHealth();

    // Display results
    console.log(`\n📊 Overall System Health: ${getHealthEmoji(health.overall)} ${health.overall.toUpperCase()}`);
    console.log(`📈 Summary: ${health.summary.healthy} healthy, ${health.summary.warnings} warnings, ${health.summary.errors} errors\n`);

    // Display system info
    console.log('💻 System Information:');
    console.log(`   Platform: ${health.systemInfo.platform}`);
    console.log(`   Node.js: ${health.systemInfo.nodeVersion}`);
    console.log(`   Memory: ${health.systemInfo.memory.used}MB used / ${health.systemInfo.memory.total}MB total`);
    console.log(`   CPU: ${health.systemInfo.cpu.cores} cores, load: ${health.systemInfo.cpu.load.map(l => l.toFixed(2)).join(', ')}`);
    console.log(`   Uptime: ${Math.round(health.systemInfo.uptime / 3600)}h\n`);

    // Display individual checks
    console.log('🔧 Component Health Checks:');
    for (const check of health.checks) {
      const emoji = getStatusEmoji(check.status);
      const duration = check.duration ? `(${check.duration}ms)` : '';
      console.log(`   ${emoji} ${check.component.padEnd(12)} ${check.message} ${duration}`);
      
      if (check.details && (check.status === 'warning' || check.status === 'error')) {
        console.log(`      Details: ${JSON.stringify(check.details, null, 2)}`);
      }
    }

    // Example of checking specific components
    console.log('\n🎯 Specific Component Checks:');
    const nodeCheck = await healthChecker.checkComponent('node');
    const memoryCheck = await healthChecker.checkComponent('memory');
    
    console.log(`   Node.js: ${getStatusEmoji(nodeCheck.status)} ${nodeCheck.message}`);
    console.log(`   Memory:  ${getStatusEmoji(memoryCheck.status)} ${memoryCheck.message}`);

    // Exit with appropriate code
    process.exit(health.overall === 'unhealthy' ? 1 : 0);

  } catch (error) {
    console.error('❌ Health check failed:', error);
    process.exit(1);
  }
}

function getHealthEmoji(status: string): string {
  switch (status) {
    case 'healthy': return '✅';
    case 'degraded': return '⚠️';
    case 'unhealthy': return '❌';
    default: return '❓';
  }
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'healthy': return '✅';
    case 'warning': return '⚠️';
    case 'error': return '❌';
    case 'unknown': return '❓';
    default: return '❓';
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}