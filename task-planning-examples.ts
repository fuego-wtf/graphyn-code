/**
 * Standardized Task Planning Format (STPF) v1.0 - Implementation Examples
 * Demonstrates the format applied to Graphyn platform tasks
 */

import { 
  TaskDefinition, 
  ProjectScheduler, 
  INVESTValidator,
  CriticalPathCalculator,
  MetricsCalculator 
} from './task-planning-algorithms';

// ========================================
// EXAMPLE TASK DEFINITIONS
// ========================================

export const exampleTasks: TaskDefinition[] = [
  {
    id: "ARCH-001",
    title: "Design v11 Thread-Based Architecture",
    description: "Design comprehensive thread-first architecture for Graphyn platform supporting 10K concurrent threads with <500ms response time. Architecture must support conversation-based agent creation, WhatsApp-style testing, and automatic learning capabilities.",
    
    specification: {
      functionalRequirements: [
        "Thread state machine (building → testing → deployed → disabled → archived)",
        "Real-time SSE streaming for thread updates",
        "Organization-level isolation for multi-tenancy",
        "Agent invitation/removal system for testing threads",
        "Automatic learning when agents removed from test threads"
      ],
      nonFunctionalRequirements: [
        "Support 10,000 concurrent threads",
        "Thread creation response time <500ms",
        "SSE latency <50ms for real-time updates",
        "99.9% uptime requirement",
        "Memory footprint <10GB for full system"
      ],
      constraints: [
        "Must use Encore.dev backend framework",
        "No WebSocket support (Encore limitation)",
        "PostgreSQL with pgvector for data storage",
        "7-service architecture maximum"
      ],
      assumptions: [
        "Strands AI framework handles agent execution",
        "Claude Code provides MCP bridge integration",
        "Docker Swarm deployment on Hetzner Cloud"
      ]
    },
    
    requirementLevel: "MUST",
    
    investCriteria: {
      independent: true,
      negotiable: true,
      valuable: true,
      estimable: true,
      small: false, // This is an epic
      testable: true,
      validationNotes: "Epic task requiring breakdown into smaller stories",
      lastValidated: "2025-01-07T10:00:00Z",
      validatedBy: "architect"
    },
    
    acceptanceCriteria: [
      {
        scenario: "Thread Creation Performance",
        given: ["System is running at 80% capacity", "User has valid authentication"],
        when: ["User creates new thread via API"],
        then: ["Thread is created within 500ms", "Thread ID is returned", "SSE connection established"],
        priority: "HIGH"
      },
      {
        scenario: "Multi-tenant Isolation",
        given: ["Multiple organizations using system", "Thread belongs to Organization A"],
        when: ["User from Organization B attempts access"],
        then: ["Access is denied", "No data leakage occurs", "Audit log entry created"],
        priority: "HIGH"
      },
      {
        scenario: "Agent Learning Trigger",
        given: ["Agent is in testing thread", "Thread has conversation history"],
        when: ["Agent is removed from thread"],
        then: ["Learning process triggered", "Conversation context saved", "Agent knowledge updated"],
        priority: "MEDIUM"
      }
    ],
    
    estimation: {
      storyPoints: 34,
      confidence: "MEDIUM",
      estimationMethod: "EXPERT",
      estimationNotes: "Complex architecture design requiring multiple service interactions",
      estimatedBy: ["architect", "tech-lead"],
      estimatedAt: "2025-01-07T09:00:00Z"
    },
    
    priority: {
      moscow: "MUST",
      businessValue: 95,
      technicalRisk: "HIGH",
      marketPriority: 90,
      costOfDelay: 5000,
      dependencyImpact: 15
    },
    
    complexity: {
      level: "EPIC",
      factors: ["TECHNICAL", "PERFORMANCE", "INTEGRATION", "SECURITY"],
      complexityNotes: "Requires deep understanding of thread management, real-time systems, and multi-tenant architecture",
      unknowns: [
        "Optimal thread state persistence strategy",
        "SSE connection management at scale",
        "Learning algorithm integration points"
      ],
      researchRequired: true,
      prototypeRequired: true
    },
    
    dependencies: {
      blocks: ["BACK-012", "FRONT-023", "INFRA-005"],
      dependencyType: "HARD",
      externalDependencies: [
        {
          name: "Strands Framework Integration",
          type: "SYSTEM",
          description: "Python-based AI agent framework integration",
          expectedResolution: "2025-01-15",
          impact: "HIGH"
        }
      ]
    },
    
    apiContract: {
      endpoints: [
        {
          path: "/api/threads",
          method: "POST",
          operationId: "createThread",
          description: "Create new conversation thread",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    organizationId: { type: "string" },
                    type: { type: "string", enum: ["builder", "testing", "production"] }
                  },
                  required: ["title", "organizationId", "type"]
                }
              }
            }
          },
          responses: [
            {
              statusCode: 201,
              description: "Thread created successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      title: { type: "string" },
                      status: { type: "string" },
                      createdAt: { type: "string", format: "date-time" }
                    }
                  }
                }
              }
            }
          ]
        }
      ],
      schemas: [],
      authentication: [{ type: "bearer", bearerFormat: "JWT" }]
    },
    
    testing: {
      testingApproach: "BDD",
      unitTests: {
        required: true,
        coverageTarget: 85,
        testFramework: "Jest",
        mockingStrategy: "PARTIAL",
        criticalPaths: ["thread creation", "state transitions", "SSE streaming"]
      },
      integrationTests: {
        required: true,
        testScenarios: [
          "Thread creation with agent assignment",
          "Multi-tenant data isolation",
          "SSE connection management"
        ],
        systemsToIntegrate: ["database", "strands-engine", "auth-service"]
      },
      performanceTests: {
        required: true,
        loadTests: true,
        stressTests: true,
        targets: {
          responseTime: { target: "<500ms", measurement: "P95" },
          throughput: { target: "1000 threads/sec" }
        }
      }
    },
    
    performance: {
      responseTime: { target: "<500ms", measurement: "P95", endpoint: "/api/threads" },
      throughput: { target: "1000 req/sec" },
      resourceUsage: { memory: "<2GB", cpu: "<70%" },
      availability: { uptime: "99.9%" },
      scalability: { users: "10K concurrent" }
    },
    
    definitionOfReady: {
      criteria: [
        "Architecture diagrams completed",
        "Service boundaries defined",
        "API contracts specified",
        "Performance targets agreed",
        "Security requirements validated",
        "Dependencies identified and planned"
      ],
      checkedBy: "product-owner",
      checkedAt: "2025-01-07T08:00:00Z"
    },
    
    definitionOfDone: {
      criteria: [
        "Architecture documentation complete",
        "Service interfaces defined",
        "API specifications validated",
        "Performance benchmarks met",
        "Security review passed",
        "Integration tests passing",
        "Code review approved",
        "Deployment automation working"
      ]
    },
    
    createdAt: "2025-01-07T08:00:00Z",
    updatedAt: "2025-01-07T10:00:00Z",
    assignee: "architect",
    reviewer: "tech-lead",
    status: "READY"
  },

  {
    id: "BACK-012",
    title: "Implement JWT Authentication Service",
    description: "Create secure JWT-based authentication service with <50ms validation time supporting 10,000 concurrent users. Must integrate with Better Auth and provide organization-level isolation.",
    
    specification: {
      functionalRequirements: [
        "JWT token generation with configurable expiry",
        "Token validation endpoint with sub-50ms response",
        "Token refresh mechanism",
        "Organization-based token scoping",
        "Better Auth integration for user management"
      ],
      nonFunctionalRequirements: [
        "Token validation <50ms P95",
        "Support 10,000 concurrent validations",
        "99.99% availability",
        "Secure token storage and transmission",
        "Rate limiting protection"
      ],
      constraints: [
        "Must use Encore.dev service framework",
        "PostgreSQL for token storage",
        "Redis for token caching",
        "Better Auth as identity provider"
      ],
      assumptions: [
        "Better Auth handles user registration",
        "Organization data already exists",
        "HTTPS termination at load balancer"
      ]
    },
    
    requirementLevel: "MUST",
    
    investCriteria: {
      independent: true,
      negotiable: true,
      valuable: true,
      estimable: true,
      small: true,
      testable: true,
      validationNotes: "Well-defined authentication service with clear boundaries",
      lastValidated: "2025-01-07T11:00:00Z",
      validatedBy: "tech-lead"
    },
    
    acceptanceCriteria: [
      {
        scenario: "JWT Token Generation",
        given: ["Valid user credentials", "User belongs to organization"],
        when: ["Authentication request submitted"],
        then: ["JWT token generated", "Token contains org claims", "Response time <50ms"],
        examples: [
          {
            "user": "john@acme.com",
            "org": "acme-corp",
            "expected_claims": ["sub", "org", "exp", "iat"]
          }
        ],
        priority: "HIGH"
      },
      {
        scenario: "Token Validation Performance",
        given: ["System under 80% load", "Valid JWT token provided"],
        when: ["Token validation requested"],
        then: ["Token validated within 50ms", "User claims returned", "Organization verified"],
        priority: "HIGH"
      }
    ],
    
    estimation: {
      storyPoints: 8,
      confidence: "HIGH",
      estimationMethod: "PLANNING_POKER",
      estimationNotes: "Standard auth service implementation",
      estimatedBy: ["backend-dev-1", "backend-dev-2", "tech-lead"],
      estimatedAt: "2025-01-07T11:30:00Z"
    },
    
    priority: {
      moscow: "MUST",
      businessValue: 90,
      technicalRisk: "MEDIUM",
      marketPriority: 95,
      costOfDelay: 2000
    },
    
    complexity: {
      level: "COMPLEX",
      factors: ["SECURITY", "PERFORMANCE", "INTEGRATION"],
      complexityNotes: "Requires careful security implementation and performance optimization",
      unknowns: ["Optimal token caching strategy", "Rate limiting configuration"]
    },
    
    dependencies: {
      blockedBy: ["ARCH-001"],
      dependencyType: "HARD",
      externalDependencies: [
        {
          name: "Better Auth Configuration",
          type: "SYSTEM",
          description: "Better Auth setup and configuration",
          expectedResolution: "2025-01-10",
          impact: "MEDIUM"
        }
      ]
    },
    
    testing: {
      testingApproach: "TDD",
      unitTests: {
        required: true,
        coverageTarget: 95,
        criticalPaths: ["token generation", "token validation", "org verification"]
      },
      securityTests: {
        required: true,
        vulnerabilityScanning: true,
        authenticationTesting: true
      }
    },
    
    performance: {
      responseTime: { target: "<50ms", measurement: "P95" },
      throughput: { target: "10K validations/sec" }
    },
    
    createdAt: "2025-01-07T11:00:00Z",
    updatedAt: "2025-01-07T11:30:00Z",
    assignee: "backend-dev-1",
    status: "READY"
  },

  {
    id: "FRONT-023",
    title: "Build Thread Management UI Components",
    description: "Create React components for thread management including thread creation, participant management, and real-time message display using SSE streams.",
    
    specification: {
      functionalRequirements: [
        "Thread creation modal with form validation",
        "Thread list with real-time updates",
        "Participant management (add/remove)",
        "Message display with SSE streaming",
        "Thread status indicators"
      ],
      nonFunctionalRequirements: [
        "60 FPS UI performance",
        "Sub-100ms UI response time",
        "Accessibility compliance (WCAG 2.1 AA)",
        "Mobile responsive design",
        "SSE reconnection handling"
      ],
      constraints: [
        "Next.js 15 with App Router",
        "React 18 with Suspense",
        "Tailwind CSS styling",
        "Zustand for state management"
      ],
      assumptions: [
        "Backend APIs ready for integration",
        "Design system components available",
        "SSE streaming endpoints functional"
      ]
    },
    
    requirementLevel: "MUST",
    
    investCriteria: {
      independent: false, // Depends on backend APIs
      negotiable: true,
      valuable: true,
      estimable: true,
      small: true,
      testable: true,
      validationNotes: "UI components with external dependencies",
      lastValidated: "2025-01-07T12:00:00Z",
      validatedBy: "frontend-lead"
    },
    
    acceptanceCriteria: [
      {
        scenario: "Thread Creation Flow",
        given: ["User is authenticated", "Organization context available"],
        when: ["User clicks create thread button"],
        then: ["Modal opens", "Form validates input", "Thread created successfully", "UI updates in real-time"],
        priority: "HIGH"
      },
      {
        scenario: "Real-time Message Display",
        given: ["Thread is active", "SSE connection established"],
        when: ["New message received via SSE"],
        then: ["Message appears immediately", "UI scrolls to latest", "No full page refresh"],
        priority: "HIGH"
      }
    ],
    
    estimation: {
      storyPoints: 13,
      confidence: "HIGH",
      estimationMethod: "T_SHIRT",
      estimationNotes: "Standard React component development",
      estimatedBy: ["frontend-dev-1", "frontend-dev-2"],
      estimatedAt: "2025-01-07T12:15:00Z"
    },
    
    priority: {
      moscow: "MUST",
      businessValue: 85,
      technicalRisk: "LOW",
      marketPriority: 80
    },
    
    complexity: {
      level: "COMPLEX",
      factors: ["UI_UX", "INTEGRATION", "PERFORMANCE"],
      complexityNotes: "Real-time UI updates with SSE integration"
    },
    
    dependencies: {
      blockedBy: ["BACK-012", "ARCH-001"],
      dependencyType: "HARD"
    },
    
    testing: {
      testingApproach: "BDD",
      unitTests: {
        required: true,
        coverageTarget: 80,
        testFramework: "Jest + React Testing Library"
      },
      e2eTests: {
        required: true,
        criticalPaths: ["thread creation", "real-time messaging"],
        browsers: ["Chrome", "Firefox", "Safari"]
      }
    },
    
    createdAt: "2025-01-07T12:00:00Z",
    updatedAt: "2025-01-07T12:15:00Z",
    assignee: "frontend-dev-1",
    status: "BACKLOG"
  },

  {
    id: "INFRA-005",
    title: "Setup Docker Swarm Deployment Pipeline",
    description: "Configure automated deployment pipeline using Docker Swarm with Traefik gateway, health checks, and rollback capabilities for Hetzner Cloud infrastructure.",
    
    specification: {
      functionalRequirements: [
        "Docker Swarm cluster configuration",
        "Traefik API gateway setup",
        "Automated deployment from Git",
        "Health check monitoring",
        "Rollback mechanism",
        "SSL certificate management"
      ],
      nonFunctionalRequirements: [
        "Zero-downtime deployments",
        "99.9% infrastructure uptime",
        "Automated SSL renewal",
        "Deployment time <5 minutes",
        "Monitoring and alerting"
      ],
      constraints: [
        "Hetzner Cloud infrastructure",
        "Docker Swarm orchestration",
        "Traefik reverse proxy",
        "Let's Encrypt SSL certificates"
      ],
      assumptions: [
        "Hetzner Cloud access configured",
        "Domain DNS properly configured",
        "Docker images build successfully"
      ]
    },
    
    requirementLevel: "MUST",
    
    investCriteria: {
      independent: true,
      negotiable: false,
      valuable: true,
      estimable: true,
      small: true,
      testable: true,
      validationNotes: "Infrastructure setup with clear success criteria",
      lastValidated: "2025-01-07T13:00:00Z",
      validatedBy: "devops-lead"
    },
    
    acceptanceCriteria: [
      {
        scenario: "Automated Deployment",
        given: ["Code pushed to main branch", "Docker images built"],
        when: ["Deployment pipeline triggered"],
        then: ["Services deployed to swarm", "Health checks pass", "No downtime occurred"],
        priority: "HIGH"
      },
      {
        scenario: "Rollback Capability",
        given: ["Deployment failed health checks", "Previous version available"],
        when: ["Rollback initiated"],
        then: ["Previous version restored", "Service health restored", "Incident logged"],
        priority: "HIGH"
      }
    ],
    
    estimation: {
      storyPoints: 5,
      confidence: "HIGH",
      estimationMethod: "HISTORICAL",
      estimationNotes: "Similar to previous Docker Swarm setups",
      estimatedBy: ["devops-lead"],
      estimatedAt: "2025-01-07T13:30:00Z"
    },
    
    priority: {
      moscow: "MUST",
      businessValue: 75,
      technicalRisk: "MEDIUM",
      dependencyImpact: 8
    },
    
    complexity: {
      level: "SIMPLE",
      factors: ["INFRASTRUCTURE", "INTEGRATION"],
      complexityNotes: "Standard Docker Swarm deployment pattern"
    },
    
    dependencies: {
      blockedBy: ["ARCH-001"],
      dependencyType: "SOFT"
    },
    
    testing: {
      testingApproach: "ATDD",
      integrationTests: {
        required: true,
        testScenarios: ["deployment automation", "health check validation", "rollback procedure"]
      }
    },
    
    createdAt: "2025-01-07T13:00:00Z",
    updatedAt: "2025-01-07T13:30:00Z",
    assignee: "devops-lead",
    status: "READY"
  },

  {
    id: "TEST-007",
    title: "Implement Performance Test Suite",
    description: "Create comprehensive performance testing suite for thread management system including load tests, stress tests, and performance benchmarking automation.",
    
    specification: {
      functionalRequirements: [
        "Load testing for thread creation",
        "Stress testing for concurrent operations",
        "Performance regression detection",
        "Automated benchmark reporting",
        "CI/CD integration"
      ],
      nonFunctionalRequirements: [
        "Test execution time <30 minutes",
        "Support for 10K+ concurrent users",
        "Performance trend analysis",
        "Automated alerting on regressions"
      ],
      constraints: [
        "Must integrate with existing CI/CD",
        "Use k6 or similar load testing tool",
        "Results stored in time-series database",
        "Dashboard for performance metrics"
      ],
      assumptions: [
        "Test environment mirrors production",
        "Performance baselines established",
        "Monitoring infrastructure available"
      ]
    },
    
    requirementLevel: "SHOULD",
    
    investCriteria: {
      independent: false,
      negotiable: true,
      valuable: true,
      estimable: true,
      small: true,
      testable: true,
      validationNotes: "Testing infrastructure depends on core services",
      lastValidated: "2025-01-07T14:00:00Z",
      validatedBy: "qa-lead"
    },
    
    acceptanceCriteria: [
      {
        scenario: "Load Test Execution",
        given: ["System deployed to test environment", "Baseline metrics established"],
        when: ["Load test executed with 1000 concurrent users"],
        then: ["All performance targets met", "No errors in response", "Metrics collected"],
        priority: "HIGH"
      }
    ],
    
    estimation: {
      storyPoints: 8,
      confidence: "MEDIUM",
      estimationMethod: "PLANNING_POKER",
      estimationNotes: "Performance testing setup requires infrastructure knowledge",
      estimatedBy: ["qa-lead", "devops-lead"],
      estimatedAt: "2025-01-07T14:30:00Z"
    },
    
    priority: {
      moscow: "SHOULD",
      businessValue: 60,
      technicalRisk: "LOW"
    },
    
    complexity: {
      level: "COMPLEX",
      factors: ["TECHNICAL", "PERFORMANCE", "INTEGRATION"],
      complexityNotes: "Requires understanding of system performance characteristics"
    },
    
    dependencies: {
      blockedBy: ["BACK-012", "INFRA-005"],
      dependencyType: "HARD"
    },
    
    testing: {
      testingApproach: "ATDD",
      performanceTests: {
        required: true,
        loadTests: true,
        stressTests: true,
        targets: {
          responseTime: { target: "<500ms", measurement: "P95" },
          throughput: { target: "1000 threads/sec" }
        }
      }
    },
    
    createdAt: "2025-01-07T14:00:00Z",
    updatedAt: "2025-01-07T14:30:00Z",
    assignee: "qa-lead",
    status: "BACKLOG"
  }
];

// ========================================
// DEMONSTRATION FUNCTIONS
// ========================================

export function demonstrateTaskPlanningFormat(): void {
  console.log("🚀 Standardized Task Planning Format (STPF) v1.0 Demonstration\n");
  
  // 1. Validate all tasks against INVEST criteria
  console.log("📋 INVEST Validation Results:");
  const validationResults = INVESTValidator.validateBatch(exampleTasks);
  
  validationResults.forEach((result, taskId) => {
    console.log(`${taskId}: ${result.valid ? '✅' : '❌'} Score: ${result.score}%`);
    if (!result.valid) {
      result.issues.forEach(issue => console.log(`  - ${issue}`));
    }
  });
  
  console.log("\n");
  
  // 2. Calculate Critical Path
  console.log("🎯 Critical Path Analysis:");
  const criticalPath = CriticalPathCalculator.calculate(exampleTasks);
  console.log(`Critical Path Length: ${criticalPath.totalDuration} story points`);
  console.log(`Critical Path Tasks: ${criticalPath.criticalPath.join(' → ')}`);
  
  // Show task details
  console.log("\nTask Scheduling Details:");
  criticalPath.taskDetails.forEach((details, taskId) => {
    console.log(`${taskId}:`);
    console.log(`  Duration: ${details.duration}, Slack: ${details.slack}`);
    console.log(`  Schedule: ${details.earliestStart}-${details.earliestFinish} (earliest)`);
    console.log(`  Critical: ${details.isCritical ? 'Yes' : 'No'}`);
  });
  
  console.log("\n");
  
  // 3. Create Optimal Schedule
  console.log("📅 Optimal Project Schedule:");
  const schedule = ProjectScheduler.createOptimalSchedule(exampleTasks);
  
  schedule.schedule.forEach(batch => {
    console.log(`Batch ${batch.batchId + 1}:`);
    console.log(`  Tasks: ${batch.tasks.join(', ')}`);
    console.log(`  Duration: ${batch.estimatedDuration} story points`);
    console.log(`  Resources: ${batch.requiredResources.join(', ')}`);
  });
  
  console.log("\n");
  
  // 4. Project Metrics
  console.log("📊 Project Metrics:");
  const metrics = schedule.metrics;
  console.log(`Total Story Points: ${metrics.velocity.plannedStoryPoints}`);
  console.log(`INVEST Compliance: ${metrics.quality.investCompliance}%`);
  console.log(`Test Coverage Expected: ${metrics.quality.testCoverage}%`);
  console.log(`Parallelization Ratio: ${metrics.efficiency.parallelizationRatio.toFixed(2)}`);
  console.log(`Risk Score: ${metrics.predictability.riskScore}%`);
  
  console.log("\n");
  
  // 5. Generate Full Report
  console.log("📄 Generating Full Project Report...");
  const report = ProjectScheduler.generateScheduleReport(exampleTasks);
  console.log(report);
}

// ========================================
// VALIDATION EXAMPLES
// ========================================

export function demonstrateValidationFramework(): void {
  console.log("🔍 Validation Framework Demonstration\n");
  
  const task = exampleTasks[1]; // BACK-012 JWT Authentication
  
  // INVEST Validation
  console.log("📋 INVEST Criteria Validation:");
  const investResult = INVESTValidator.validate(task);
  console.log(`Task ${task.id}:`);
  console.log(`  Valid: ${investResult.valid ? '✅' : '❌'}`);
  console.log(`  Score: ${investResult.score}%`);
  
  if (!investResult.valid) {
    console.log("  Issues:");
    investResult.issues.forEach(issue => console.log(`    - ${issue}`));
  }
  
  console.log("\n");
  
  // Definition of Ready
  console.log("🚦 Definition of Ready Validation:");
  const readyResult = ReadinessValidator.validateDefinitionOfReady(task);
  console.log(`  Ready: ${readyResult.valid ? '✅' : '❌'}`);
  console.log(`  Score: ${readyResult.score}%`);
  
  if (!readyResult.valid) {
    console.log("  Missing:");
    readyResult.issues.forEach(issue => console.log(`    - ${issue}`));
  }
  
  console.log("\n");
  
  // Performance Target Validation
  console.log("⚡ Performance Target Analysis:");
  if (task.performance?.responseTime) {
    console.log(`  Response Time Target: ${task.performance.responseTime.target}`);
    console.log(`  Measurement: ${task.performance.responseTime.measurement}`);
  }
  
  if (task.performance?.throughput) {
    console.log(`  Throughput Target: ${task.performance.throughput.target}`);
  }
}

// ========================================
// ALGORITHM TESTING
// ========================================

export function testDependencyAlgorithms(): void {
  console.log("🔗 Dependency Resolution Algorithm Testing\n");
  
  try {
    // Test topological sorting
    const sortedIds = DependencyResolver.topologicalSort(exampleTasks);
    console.log("✅ Topological Sort Successful:");
    console.log(`  Execution Order: ${sortedIds.join(' → ')}`);
    
    // Validate dependencies
    const depValidation = DependencyResolver.validateDependencies(exampleTasks);
    console.log(`\n📊 Dependency Validation:`);
    console.log(`  Valid: ${depValidation.valid ? '✅' : '❌'}`);
    console.log(`  Score: ${depValidation.score}%`);
    
    if (!depValidation.valid) {
      console.log("  Issues:");
      depValidation.issues.forEach(issue => console.log(`    - ${issue}`));
    }
    
  } catch (error) {
    console.error(`❌ Dependency Resolution Failed: ${error.message}`);
  }
}

// ========================================
// MAIN DEMONSTRATION
// ========================================

export function runFullDemo(): void {
  console.log("=" .repeat(80));
  console.log("STANDARDIZED TASK PLANNING FORMAT (STPF) v1.0 - FULL DEMONSTRATION");
  console.log("=" .repeat(80));
  console.log("\n");
  
  demonstrateTaskPlanningFormat();
  console.log("\n" + "=".repeat(80) + "\n");
  
  demonstrateValidationFramework();
  console.log("\n" + "=".repeat(80) + "\n");
  
  testDependencyAlgorithms();
  
  console.log("\n" + "=".repeat(80));
  console.log("DEMONSTRATION COMPLETE ✅");
  console.log("=".repeat(80));
}

// Run demonstration if this file is executed directly
if (require.main === module) {
  runFullDemo();
}