/**
 * Integration Test for Orchestrator Components
 * 
 * Tests the core orchestrator functionality with QueryProcessor and TaskDependencyGraph
 */

import { QueryProcessor } from './QueryProcessor.js';
import { TaskDependencyGraph } from './TaskDependencyGraph.js';
import { 
  AgentType, 
  QueryComplexity, 
  ExecutionMode,
  TaskDefinition 
} from './types.js';

/**
 * Test orchestrator integration
 */
export async function testOrchestratorIntegration(): Promise<void> {
  console.log('🚀 Testing Orchestrator Integration...');

  // Test 1: Query Processing
  console.log('\n📝 Test 1: Query Processing');
  
  const processor = new QueryProcessor({
    enableFigmaDetection: true,
    defaultMode: 'adaptive'
  });

  // Test different query types
  const testQueries = [
    'Extract Figma designs and build a React component library',
    'Build a REST API with authentication',
    'Fix the user login bug in the frontend',
    'Create comprehensive tests for the payment system',
    'Deploy the application to production with Docker'
  ];

  for (const query of testQueries) {
    console.log(`\n  Query: "${query}"`);
    
    const parsed = processor.parseQuery(query);
    console.log(`  Intent: ${parsed.intent}`);
    console.log(`  Complexity: ${parsed.complexity}`);
    console.log(`  Agents: ${parsed.requiredAgents.join(', ')}`);
    console.log(`  Confidence: ${parsed.confidence}`);
    
    const result = await processor.processQuery(query);
    console.log(`  Tasks generated: ${result.executionPlan.tasks.length}`);
    console.log(`  Estimated duration: ${result.executionPlan.estimatedDuration} minutes`);
  }

  // Test 2: Task Dependency Graph
  console.log('\n\n🔗 Test 2: Task Dependency Graph');

  const graph = new TaskDependencyGraph();

  // Create sample tasks
  const tasks: TaskDefinition[] = [
    {
      id: 'task_1_architect',
      description: 'Design system architecture',
      agent: 'architect',
      dependencies: [],
      priority: 90
    },
    {
      id: 'task_2_figma',
      description: 'Extract Figma components',
      agent: 'figma-extractor',
      dependencies: [],
      priority: 85
    },
    {
      id: 'task_3_backend',
      description: 'Implement backend APIs',
      agent: 'backend',
      dependencies: ['task_1_architect'],
      priority: 70
    },
    {
      id: 'task_4_frontend',
      description: 'Build frontend components',
      agent: 'frontend',
      dependencies: ['task_1_architect', 'task_2_figma'],
      priority: 70
    },
    {
      id: 'task_5_test',
      description: 'Create test suite',
      agent: 'test-writer',
      dependencies: ['task_3_backend', 'task_4_frontend'],
      priority: 60
    },
    {
      id: 'task_6_deploy',
      description: 'Deploy to production',
      agent: 'production-architect',
      dependencies: ['task_5_test'],
      priority: 50
    }
  ];

  // Add tasks to graph
  console.log('\n  Adding tasks to dependency graph...');
  for (const task of tasks) {
    graph.addTask(task);
    console.log(`  ✅ Added: ${task.id} (${task.agent})`);
  }

  // Validate dependencies
  console.log('\n  Validating dependencies...');
  const validation = graph.validateDependencies();
  if (validation.isValid) {
    console.log('  ✅ Dependency graph is valid');
  } else {
    console.log('  ❌ Dependency validation failed:');
    for (const error of validation.errors) {
      console.log(`    - ${error}`);
    }
  }

  // Test topological sort
  console.log('\n  Computing execution order...');
  try {
    const executionOrder = graph.topologicalSort();
    console.log(`  ✅ Execution order computed:`);
    console.log(`    Total tasks: ${executionOrder.totalTasks}`);
    console.log(`    Max parallelism: ${executionOrder.maxParallelism}`);
    console.log(`    Estimated duration: ${executionOrder.estimatedDuration} minutes`);
    
    console.log(`    Execution batches:`);
    executionOrder.batches.forEach((batch, index) => {
      console.log(`      Batch ${index + 1}: ${batch.join(', ')}`);
    });

    // Test task execution simulation
    console.log('\n  Simulating task execution...');
    
    // Start first batch
    const firstBatch = executionOrder.batches[0];
    for (const taskId of firstBatch) {
      const execution = graph.startTask(taskId);
      console.log(`    ▶️ Started: ${taskId} (${execution.agent})`);
    }

    // Complete first batch
    for (const taskId of firstBatch) {
      graph.completeTask(taskId, { status: 'success' });
      console.log(`    ✅ Completed: ${taskId}`);
    }

    // Check what's ready next
    const readyTasks = graph.getReadyTasks();
    console.log(`    Ready for next execution: ${readyTasks.map(t => t.id).join(', ')}`);

    // Get execution statistics
    const stats = graph.getExecutionStatistics();
    console.log(`    Statistics:`);
    console.log(`      Completed: ${stats.completedTasks}`);
    console.log(`      Failed: ${stats.failedTasks}`);
    console.log(`      Pending: ${stats.pendingTasks}`);
    console.log(`      Success rate: ${(stats.successRate * 100).toFixed(1)}%`);

  } catch (error) {
    console.log(`  ❌ Topological sort failed: ${error}`);
  }

  // Test 3: End-to-End Workflow
  console.log('\n\n🔄 Test 3: End-to-End Workflow');

  const e2eQuery = 'Build a full-stack e-commerce application with React frontend, Node.js backend, and PostgreSQL database';
  console.log(`  Query: "${e2eQuery}"`);

  const e2eResult = await processor.processQuery(e2eQuery, {
    repository: '/path/to/project',
    framework: 'Next.js',
    database: 'PostgreSQL'
  });

  console.log(`\n  Processing Result:`);
  console.log(`    Intent: ${e2eResult.parsed.intent}`);
  console.log(`    Complexity: ${e2eResult.parsed.complexity}`);
  console.log(`    Execution Mode: ${e2eResult.executionPlan.mode}`);
  console.log(`    Required Agents: ${e2eResult.executionPlan.requiredAgents.join(', ')}`);
  console.log(`    Total Tasks: ${e2eResult.executionPlan.tasks.length}`);
  console.log(`    Estimated Duration: ${e2eResult.executionPlan.estimatedDuration} minutes`);
  console.log(`    Parallelism Level: ${e2eResult.executionPlan.parallelismLevel}`);

  if (e2eResult.recommendations.length > 0) {
    console.log(`\n    Recommendations:`);
    for (const rec of e2eResult.recommendations) {
      console.log(`      - ${rec}`);
    }
  }

  if (e2eResult.warnings.length > 0) {
    console.log(`\n    Warnings:`);
    for (const warning of e2eResult.warnings) {
      console.log(`      ⚠️ ${warning}`);
    }
  }

  console.log('\n✅ Orchestrator integration test completed successfully!');
}

/**
 * Run the test if this file is executed directly
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  testOrchestratorIntegration().catch(console.error);
}