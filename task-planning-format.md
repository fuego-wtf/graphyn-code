# Standardized Task Planning Format (STPF) v1.0

## Mathematical Foundation & Algorithms

### 1. Dependency Resolution Algorithm (Topological Sorting)

```typescript
interface TaskNode {
  id: string;
  dependencies: string[];
  dependents: string[];
  visited: boolean;
  inStack: boolean;
}

function topologicalSort(tasks: TaskNode[]): string[] {
  const result: string[] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();
  
  function dfsVisit(taskId: string) {
    if (stack.has(taskId)) throw new Error(`Circular dependency detected: ${taskId}`);
    if (visited.has(taskId)) return;
    
    stack.add(taskId);
    const task = tasks.find(t => t.id === taskId);
    task?.dependencies.forEach(depId => dfsVisit(depId));
    stack.delete(taskId);
    visited.add(taskId);
    result.unshift(taskId);
  }
  
  tasks.forEach(task => {
    if (!visited.has(task.id)) dfsVisit(task.id);
  });
  
  return result;
}
```

### 2. Critical Path Method (CPM) Implementation

```typescript
interface CriticalPathResult {
  criticalPath: string[];
  totalDuration: number;
  taskDetails: Map<string, {
    earliestStart: number;
    latestStart: number;
    earliestFinish: number;
    latestFinish: number;
    slack: number;
    isCritical: boolean;
  }>;
}

function calculateCriticalPath(tasks: TaskDefinition[]): CriticalPathResult {
  // Forward pass - calculate earliest times
  // Backward pass - calculate latest times  
  // Identify critical path where slack = 0
}
```

### 3. Resource Optimization Algorithm

```typescript
interface ResourceConstraint {
  resourceId: string;
  capacity: number;
  allocatedTasks: string[];
}

function optimizeResourceAllocation(
  tasks: TaskDefinition[],
  resources: ResourceConstraint[]
): TaskSchedule {
  // Implements list scheduling with resource leveling
  // Uses greedy algorithm with priority-based task selection
  return scheduleWithConstraints(tasks, resources);
}
```

## Task Definition Schema (OpenAPI 3.0 Compatible)

```yaml
TaskDefinition:
  type: object
  required:
    - id
    - title
    - description
    - acceptanceCriteria
    - requirementLevel
    - estimation
    - priority
    - complexity
  properties:
    # Core Identification
    id:
      type: string
      pattern: "^(ARCH|BACK|FRONT|INFRA|TEST)-[0-9]{3}$"
      example: "BACK-012"
    
    title:
      type: string
      maxLength: 100
      description: "Concise task title following INVEST criteria"
    
    description:
      type: string
      maxLength: 1000
      description: "Detailed task description with business context"
    
    # IEEE 830 Specification Structure
    specification:
      $ref: "#/components/schemas/IEEE830Specification"
    
    # RFC 2119 Requirement Levels
    requirementLevel:
      type: string
      enum: ["MUST", "SHOULD", "MAY", "MUST_NOT", "SHOULD_NOT"]
      description: "RFC 2119 requirement classification"
    
    # INVEST Criteria Validation
    investCriteria:
      $ref: "#/components/schemas/INVESTValidation"
    
    # Acceptance Criteria (BDD Format)
    acceptanceCriteria:
      type: array
      items:
        $ref: "#/components/schemas/AcceptanceCriterion"
      minItems: 1
    
    # Estimation (Fibonacci Sequence)
    estimation:
      type: object
      required: ["storyPoints", "confidence"]
      properties:
        storyPoints:
          type: integer
          enum: [1, 2, 3, 5, 8, 13, 21, 34, 55, 89]
          description: "Fibonacci-based story point estimation"
        confidence:
          type: string
          enum: ["HIGH", "MEDIUM", "LOW"]
        estimationNotes:
          type: string
          maxLength: 500
    
    # MoSCoW Prioritization
    priority:
      type: object
      required: ["moscow", "businessValue"]
      properties:
        moscow:
          type: string
          enum: ["MUST", "SHOULD", "COULD", "WONT"]
          description: "MoSCoW prioritization classification"
        businessValue:
          type: integer
          minimum: 1
          maximum: 100
          description: "Business value score (1-100)"
        technicalRisk:
          type: string
          enum: ["HIGH", "MEDIUM", "LOW"]
    
    # Complexity Classification
    complexity:
      type: object
      required: ["level", "factors"]
      properties:
        level:
          type: string
          enum: ["SIMPLE", "COMPLEX", "EPIC"]
        factors:
          type: array
          items:
            type: string
            enum: ["TECHNICAL", "BUSINESS", "INTEGRATION", "PERFORMANCE", "SECURITY"]
        complexityNotes:
          type: string
          maxLength: 300
    
    # Dependency Management
    dependencies:
      type: object
      properties:
        blockedBy:
          type: array
          items:
            type: string
            pattern: "^(ARCH|BACK|FRONT|INFRA|TEST)-[0-9]{3}$"
        blocks:
          type: array
          items:
            type: string
            pattern: "^(ARCH|BACK|FRONT|INFRA|TEST)-[0-9]{3}$"
        dependencyType:
          type: string
          enum: ["HARD", "SOFT", "PREFERENTIAL"]
    
    # API Contract Specification
    apiContract:
      $ref: "#/components/schemas/OpenAPIContract"
    
    # Testing Requirements
    testing:
      $ref: "#/components/schemas/TestingRequirements"
    
    # Performance Targets
    performance:
      $ref: "#/components/schemas/PerformanceTargets"
    
    # Definition of Ready/Done
    definitionOfReady:
      $ref: "#/components/schemas/DefinitionOfReady"
    
    definitionOfDone:
      $ref: "#/components/schemas/DefinitionOfDone"

# Supporting Schemas

IEEE830Specification:
  type: object
  properties:
    functionalRequirements:
      type: array
      items:
        type: string
    nonFunctionalRequirements:
      type: array
      items:
        type: string
    constraints:
      type: array
      items:
        type: string
    assumptions:
      type: array
      items:
        type: string

INVESTValidation:
  type: object
  required: ["independent", "negotiable", "valuable", "estimable", "small", "testable"]
  properties:
    independent:
      type: boolean
      description: "Task is independent of other tasks"
    negotiable:
      type: boolean
      description: "Details can be negotiated with stakeholders"
    valuable:
      type: boolean
      description: "Delivers clear user/business value"
    estimable:
      type: boolean
      description: "Team can estimate the work required"
    small:
      type: boolean
      description: "Can be completed within one iteration"
    testable:
      type: boolean
      description: "Has clear, testable acceptance criteria"
    validationNotes:
      type: string
      maxLength: 500

AcceptanceCriterion:
  type: object
  required: ["scenario", "given", "when", "then"]
  properties:
    scenario:
      type: string
      maxLength: 200
      description: "High-level scenario description"
    given:
      type: array
      items:
        type: string
      description: "Initial context/preconditions"
    when:
      type: array
      items:
        type: string
      description: "Actions taken"
    then:
      type: array
      items:
        type: string
      description: "Expected outcomes"
    examples:
      type: array
      items:
        type: object
        additionalProperties: true

TestingRequirements:
  type: object
  properties:
    testingApproach:
      type: string
      enum: ["TDD", "BDD", "ATDD", "HYBRID"]
    unitTests:
      type: object
      properties:
        required: 
          type: boolean
        coverageTarget:
          type: integer
          minimum: 0
          maximum: 100
    integrationTests:
      type: object
      properties:
        required:
          type: boolean
        testScenarios:
          type: array
          items:
            type: string
    e2eTests:
      type: object
      properties:
        required:
          type: boolean
        criticalPaths:
          type: array
          items:
            type: string

PerformanceTargets:
  type: object
  properties:
    responseTime:
      type: object
      properties:
        target:
          type: string
          pattern: "^<[0-9]+ms$"
          example: "<50ms"
        measurement:
          type: string
          enum: ["P50", "P90", "P95", "P99"]
    throughput:
      type: object
      properties:
        target:
          type: string
          example: "1000 req/sec"
    resourceUsage:
      type: object
      properties:
        cpu:
          type: string
          example: "<80%"
        memory:
          type: string
          example: "<2GB"

DefinitionOfReady:
  type: object
  required: ["criteria"]
  properties:
    criteria:
      type: array
      items:
        type: string
      minItems: 3
      example:
        - "All acceptance criteria defined"
        - "Dependencies identified and resolved"
        - "Technical approach agreed upon"
        - "Estimation completed"
    checkedBy:
      type: string
    checkedAt:
      type: string
      format: date-time

DefinitionOfDone:
  type: object
  required: ["criteria"]
  properties:
    criteria:
      type: array
      items:
        type: string
      minItems: 5
      example:
        - "Code implemented and reviewed"
        - "All tests passing (unit, integration, e2e)"
        - "Performance targets met"
        - "Documentation updated"
        - "Security review completed"
    checkedBy:
      type: string
    checkedAt:
      type: string
      format: date-time
```

## Sequencing Algorithm Implementation

### 1. Task Priority Calculation

```typescript
function calculateTaskPriority(task: TaskDefinition): number {
  const moscowWeights = { MUST: 4, SHOULD: 3, COULD: 2, WONT: 1 };
  const complexityWeights = { SIMPLE: 1, COMPLEX: 2, EPIC: 3 };
  const riskWeights = { LOW: 1, MEDIUM: 2, HIGH: 3 };
  
  const moscowScore = moscowWeights[task.priority.moscow] * 25;
  const businessValueScore = task.priority.businessValue;
  const complexityPenalty = complexityWeights[task.complexity.level] * 5;
  const riskPenalty = riskWeights[task.priority.technicalRisk] * 10;
  
  return moscowScore + businessValueScore - complexityPenalty - riskPenalty;
}
```

### 2. Parallel Execution Identification

```typescript
interface ParallelBatch {
  batchId: number;
  tasks: string[];
  estimatedDuration: number;
  requiredResources: string[];
}

function identifyParallelBatches(sortedTasks: TaskDefinition[]): ParallelBatch[] {
  const batches: ParallelBatch[] = [];
  const scheduled = new Set<string>();
  
  let batchId = 0;
  
  while (scheduled.size < sortedTasks.length) {
    const availableTasks = sortedTasks.filter(task => 
      !scheduled.has(task.id) && 
      task.dependencies.blockedBy?.every(dep => scheduled.has(dep))
    );
    
    if (availableTasks.length === 0) {
      throw new Error("Circular dependency or unresolvable constraint");
    }
    
    const batch: ParallelBatch = {
      batchId: batchId++,
      tasks: availableTasks.map(t => t.id),
      estimatedDuration: Math.max(...availableTasks.map(t => t.estimation.storyPoints)),
      requiredResources: [...new Set(availableTasks.flatMap(t => t.apiContract?.resources || []))]
    };
    
    batches.push(batch);
    availableTasks.forEach(task => scheduled.add(task.id));
  }
  
  return batches;
}
```

## Validation Framework

### 1. INVEST Criteria Validator

```typescript
function validateINVEST(task: TaskDefinition): ValidationResult {
  const issues: string[] = [];
  
  // Independent
  if (task.dependencies.blockedBy && task.dependencies.blockedBy.length > 3) {
    issues.push("Task has too many dependencies (>3), violates Independence");
  }
  
  // Negotiable
  if (!task.description || task.description.length < 50) {
    issues.push("Description too brief, violates Negotiable criteria");
  }
  
  // Valuable
  if (task.priority.businessValue < 30) {
    issues.push("Low business value (<30), violates Valuable criteria");
  }
  
  // Estimable
  if (task.estimation.confidence === "LOW") {
    issues.push("Low estimation confidence, violates Estimable criteria");
  }
  
  // Small
  if (task.estimation.storyPoints > 13) {
    issues.push("Story points >13, violates Small criteria");
  }
  
  // Testable
  if (task.acceptanceCriteria.length === 0) {
    issues.push("No acceptance criteria, violates Testable criteria");
  }
  
  return {
    valid: issues.length === 0,
    issues,
    score: Math.max(0, 100 - (issues.length * 16.67))
  };
}
```

### 2. Definition of Ready/Done Validator

```typescript
function validateDefinitionOfReady(task: TaskDefinition): boolean {
  return [
    task.acceptanceCriteria.length > 0,
    task.estimation.storyPoints > 0,
    task.dependencies !== undefined,
    task.apiContract?.endpoints?.length > 0,
    task.testing.testingApproach !== undefined
  ].every(condition => condition);
}

function validateDefinitionOfDone(task: TaskDefinition): boolean {
  return [
    task.testing.unitTests?.required === true,
    task.performance?.responseTime?.target !== undefined,
    task.definitionOfDone.checkedBy !== undefined,
    task.apiContract?.validation?.schema !== undefined
  ].every(condition => condition);
}
```

## Progress Tracking Metrics

```typescript
interface ProjectMetrics {
  velocity: {
    plannedStoryPoints: number;
    completedStoryPoints: number;
    burndownRate: number;
  };
  quality: {
    defectRate: number;
    testCoverage: number;
    performanceCompliance: number;
  };
  efficiency: {
    cycleTime: number;
    leadTime: number;
    throughput: number;
  };
  predictability: {
    estimationAccuracy: number;
    scheduleVariance: number;
  };
}

function calculateProjectMetrics(tasks: TaskDefinition[]): ProjectMetrics {
  // Implementation details for comprehensive project tracking
}
```

## Usage Example

```typescript
const task: TaskDefinition = {
  id: "BACK-012",
  title: "Implement JWT Authentication Service",
  description: "Create secure JWT-based authentication with <50ms validation",
  
  specification: {
    functionalRequirements: [
      "JWT token generation with 24h expiry",
      "Token validation endpoint",
      "Refresh token mechanism"
    ],
    nonFunctionalRequirements: [
      "Response time <50ms for validation",
      "Support 10,000 concurrent users",
      "99.9% uptime requirement"
    ]
  },
  
  requirementLevel: "MUST",
  
  acceptanceCriteria: [{
    scenario: "User authentication with valid credentials",
    given: ["User exists in database", "Credentials are correct"],
    when: ["User submits login request"],
    then: ["JWT token is returned", "Token expires in 24h", "Response time <50ms"]
  }],
  
  estimation: {
    storyPoints: 8,
    confidence: "HIGH"
  },
  
  priority: {
    moscow: "MUST",
    businessValue: 95,
    technicalRisk: "MEDIUM"
  },
  
  complexity: {
    level: "COMPLEX",
    factors: ["SECURITY", "PERFORMANCE"]
  },
  
  testing: {
    testingApproach: "TDD",
    unitTests: {
      required: true,
      coverageTarget: 90
    }
  }
};

// Validate and schedule
const validation = validateINVEST(task);
const schedule = calculateOptimalSchedule([task]);
```

This format provides mathematical precision, algorithmic processing capabilities, and comprehensive industry standard compliance for the 26 Graphyn platform tasks.