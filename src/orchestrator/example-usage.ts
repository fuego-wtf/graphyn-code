/**
 * Example Usage of Multi-Agent Orchestrator
 * Demonstrates how to use the completed multi-agent system
 */
import { MultiAgentOrchestrator, OrchestrationRequest } from './multi-agent-orchestrator.js';
import { debug } from '../utils/debug.js';

/**
 * Example: Full-Stack Feature Implementation
 */
export async function exampleFullStackFeature() {
  console.log('🚀 Starting Multi-Agent Orchestrator Example\n');

  const orchestrator = new MultiAgentOrchestrator();

  // Define a complex full-stack request
  const request: OrchestrationRequest = {
    query: "Implement a user authentication system with login, registration, password reset, and JWT token management. Include both backend API endpoints and frontend UI components.",
    context: {
      repository: "/path/to/your/project",
      framework: "Next.js",
      language: "TypeScript",
      dependencies: ["express", "jsonwebtoken", "bcrypt", "react", "tailwind"]
    },
    agents: ["architect", "backend", "frontend", "test-writer", "production-architect"],
    mode: "adaptive" // Let the system optimize execution
  };

  try {
    // Start orchestration
    const taskId = await orchestrator.orchestrate(request);
    console.log(`📋 Task started with ID: ${taskId}\n`);

    // Set up event listeners
    setupEventListeners(orchestrator, taskId);

    // Stream progress updates
    console.log('📊 Streaming progress updates...\n');
    for await (const progress of orchestrator.streamProgress(taskId)) {
      console.log(`Progress: ${progress.progress.completed}/${progress.progress.total} tasks completed`);
      console.log(`Current stage: ${progress.progress.currentStage}`);
      
      if (progress.status === 'completed') {
        console.log('\n✅ Orchestration completed successfully!');
        console.log('📁 Results:');
        console.log(JSON.stringify(progress.results, null, 2));
        break;
      }
      
      if (progress.status === 'failed') {
        console.log('\n❌ Orchestration failed!');
        console.log('🚨 Errors:');
        progress.errors.forEach(error => console.log(`  - ${error}`));
        break;
      }
    }

  } catch (error) {
    console.error('💥 Orchestration error:', error);
  }
}

/**
 * Example: Backend-Only Task
 */
export async function exampleBackendTask() {
  const orchestrator = new MultiAgentOrchestrator();

  const request: OrchestrationRequest = {
    query: "Create REST API endpoints for user management with CRUD operations, validation, and error handling",
    context: {
      repository: "/path/to/backend/project",
      framework: "Express.js",
      language: "TypeScript"
    },
    agents: ["architect", "backend", "test-writer"],
    mode: "sequential" // Execute tasks in order
  };

  const taskId = await orchestrator.orchestrate(request);
  console.log(`Backend task started: ${taskId}`);

  return taskId;
}

/**
 * Example: Architecture Review
 */
export async function exampleArchitectureReview() {
  const orchestrator = new MultiAgentOrchestrator();

  const request: OrchestrationRequest = {
    query: "Review the current microservices architecture and propose improvements for scalability and maintainability",
    context: {
      repository: "/path/to/microservices/project",
      language: "TypeScript",
      dependencies: ["docker", "kubernetes", "redis", "postgresql"]
    },
    agents: ["architect", "production-architect"],
    mode: "parallel" // Both architects work simultaneously
  };

  const taskId = await orchestrator.orchestrate(request);
  console.log(`Architecture review started: ${taskId}`);

  return taskId;
}

/**
 * Example: Bug Fix Coordination
 */
export async function exampleBugFix() {
  const orchestrator = new MultiAgentOrchestrator();

  const request: OrchestrationRequest = {
    query: "Fix memory leak in the user session management that's causing server crashes under high load",
    context: {
      repository: "/path/to/project",
      framework: "Node.js",
      language: "TypeScript"
    },
    agents: ["task-dispatcher", "backend", "test-writer"],
    mode: "adaptive"
  };

  const taskId = await orchestrator.orchestrate(request);
  console.log(`Bug fix task started: ${taskId}`);

  return taskId;
}

/**
 * Example: Manual Agent Communication
 */
export async function exampleManualCommunication() {
  const orchestrator = new MultiAgentOrchestrator();

  // Start a simple task first
  const request: OrchestrationRequest = {
    query: "Create a simple React component",
    context: { repository: "/path/to/project" },
    agents: ["frontend"],
    mode: "sequential"
  };

  const taskId = await orchestrator.orchestrate(request);
  
  // Access the communication bus directly
  const communicationBus = (orchestrator as any).communicationBus;
  
  // Send a message to the frontend agent
  setTimeout(async () => {
    try {
      const workspaceAgents = communicationBus.getWorkspaceAgents('default');
      if (workspaceAgents.length > 0) {
        await communicationBus.sendMessage({
          from: 'system',
          to: workspaceAgents[0].sessionId,
          type: 'context_share',
          payload: {
            message: "Please make the component responsive and accessible",
            priority: "high"
          }
        });
        console.log('📧 Message sent to frontend agent');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }, 5000); // Send after 5 seconds

  return taskId;
}

/**
 * Setup event listeners for demonstration
 */
function setupEventListeners(orchestrator: MultiAgentOrchestrator, taskId: string) {
  orchestrator.on('orchestration_started', (data) => {
    console.log(`🎯 Orchestration started with ${data.tasks.length} tasks`);
    data.tasks.forEach(task => {
      console.log(`  📌 ${task.agent}: ${task.description}`);
    });
    console.log();
  });

  orchestrator.on('task_completed', (data) => {
    console.log(`✅ Task completed: [${data.task.agent}] ${data.task.description.substring(0, 50)}...`);
  });

  orchestrator.on('task_failed', (data) => {
    console.log(`❌ Task failed: [${data.task.agent}] ${data.task.description.substring(0, 50)}...`);
    console.log(`   Error: ${data.error}`);
  });

  orchestrator.on('progress_updated', (data) => {
    debug('Progress updated:', data);
  });

  orchestrator.on('orchestration_completed', (data) => {
    console.log('\n🎉 All tasks completed successfully!');
    const duration = Date.now() - data.session.startTime;
    console.log(`⏱️  Total duration: ${Math.round(duration / 1000)}s`);
  });

  orchestrator.on('orchestration_failed', (data) => {
    console.log('\n💔 Orchestration failed');
    console.log(`   Reason: ${data.error}`);
  });

  orchestrator.on('orchestration_cancelled', (data) => {
    console.log(`\n⏹️  Orchestration cancelled: ${data.taskId}`);
  });
}

/**
 * Example: Advanced Orchestration with Custom Configuration
 */
export async function exampleAdvancedOrchestration() {
  const orchestrator = new MultiAgentOrchestrator();

  // Disable progress visualization for programmatic use
  const progressTracker = (orchestrator as any).progressTracker;
  progressTracker.setVisualizationEnabled(false);

  const request: OrchestrationRequest = {
    query: "Build a complete e-commerce checkout flow with payment processing, inventory management, and order confirmation",
    context: {
      repository: "/path/to/ecommerce/project",
      framework: "Next.js",
      language: "TypeScript",
      dependencies: ["stripe", "prisma", "redis", "nextauth"]
    },
    agents: ["architect", "backend", "frontend", "test-writer", "production-architect"],
    mode: "adaptive"
  };

  const taskId = await orchestrator.orchestrate(request);
  
  // Monitor progress programmatically
  const checkProgress = setInterval(() => {
    const status = orchestrator.getStatus(taskId);
    if (status) {
      console.log(`📊 Progress: ${status.progress.completed}/${status.progress.total} (${status.status})`);
      
      if (status.status === 'completed' || status.status === 'failed') {
        clearInterval(checkProgress);
        
        if (status.status === 'completed') {
          console.log('🎯 E-commerce checkout flow completed!');
          console.log('📋 Final results:', JSON.stringify(status.results, null, 2));
        } else {
          console.log('❌ E-commerce checkout flow failed');
          console.log('🚨 Errors:', status.errors);
        }
      }
    }
  }, 2000);

  // Cancel after 5 minutes if still running (for demo)
  setTimeout(async () => {
    const status = orchestrator.getStatus(taskId);
    if (status && status.status === 'running') {
      console.log('⏰ Cancelling long-running task for demo...');
      await orchestrator.cancel(taskId);
      clearInterval(checkProgress);
    }
  }, 300000);

  return taskId;
}

/**
 * Run examples (for testing)
 */
export async function runExamples() {
  console.log('🧪 Running Multi-Agent Orchestrator Examples\n');
  
  try {
    console.log('1️⃣  Running Full-Stack Feature Example...');
    await exampleFullStackFeature();
    
    console.log('\n2️⃣  Running Backend Task Example...');
    await exampleBackendTask();
    
    console.log('\n3️⃣  Running Architecture Review Example...');
    await exampleArchitectureReview();
    
    console.log('\n4️⃣  Running Bug Fix Example...');
    await exampleBugFix();
    
    console.log('\n5️⃣  Running Advanced Orchestration Example...');
    await exampleAdvancedOrchestration();
    
    console.log('\n✨ All examples completed!');
    
  } catch (error) {
    console.error('❌ Example failed:', error);
  }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples();
}