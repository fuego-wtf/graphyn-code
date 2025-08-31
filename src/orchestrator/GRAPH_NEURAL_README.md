# Graph-Neural AI Coordination System

A revolutionary approach to multi-agent AI coordination that builds dependency graphs from natural language queries and executes agents with neural context enrichment.

## 🧠 What Makes This Revolutionary

Traditional multi-agent systems execute agents in isolation or with basic message passing. The Graph-Neural system introduces **intelligent context propagation** where each agent's output structures and enriches the prompts for dependent agents, creating a neural network of AI decision-making.

### Key Innovations

1. **Neural Prompt Enrichment**: Each Claude agent receives not just the base task, but enriched context from ALL predecessor agents
2. **Dependency Graph Intelligence**: Automatically builds optimal execution graphs from natural language
3. **Structured Output Parsing**: Extracts and propagates structured decisions, data types, and recommendations
4. **Real-Time Visualization**: Shows graph execution with live dependency resolution
5. **Adaptive Parallelization**: Maximizes parallel execution while respecting dependencies

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   GraphNeuralSystem                              │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────────┐ ┌─────────────────────────┐  │
│ │GraphBuilder │ │  GraphFlowEngine │ │    InputEnricher       │  │
│ │- NLP Analysis│ │- Topological Sort│ │- Context Propagation   │  │
│ │- Dependency  │ │- Parallel Exec  │ │- Prompt Templates      │  │
│ │  Detection   │ │- Error Handling │ │- Neural Instructions   │  │
│ └─────────────┘ └─────────────────┘ └─────────────────────────┘  │
│        │                  │                       │              │
│        ▼                  ▼                       ▼              │
│ ┌─────────────────────────────────────────────────────────────┐   │
│ │              OutputPropagator                                │   │
│ │- Structured Parsing  - Context Extraction                   │   │
│ │- Network Effects     - Quality Assessment                   │   │
│ └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

```typescript
import { GraphNeuralSystem } from '@graphyn/code/orchestrator';

const system = new GraphNeuralSystem();

const result = await system.execute({
  query: "Build e-commerce checkout flow with payment processing",
  context: {
    repository: "/path/to/project",
    framework: "Next.js",
    language: "TypeScript"
  },
  options: {
    mode: "neural",
    parallelismLevel: "high",
    maxNodes: 8
  }
});

if (result.success) {
  console.log(`✅ Completed in ${result.metrics?.totalExecutionTime}ms`);
  console.log(`🧠 Neural enrichment: ${result.metrics?.neuralEnrichmentOverhead}ms`);
}
```

## 🎯 Neural Flow Example

### Traditional Multi-Agent Flow:
```
architect → backend → frontend → test-writer
(Each agent works in isolation with basic task description)
```

### Graph-Neural Flow:
```
User Query: "create e-commerce checkout flow"

1. architect → outputs: {
     "decisions": ["PostgreSQL database", "Stripe payments", "JWT auth"],
     "dataTypes": {"Order": "...", "Payment": "...", "User": "..."},
     "apiEndpoints": ["/api/orders", "/api/payments"]
   }

2. backend → receives enriched prompt:
   "Build checkout API. CONTEXT: Use PostgreSQL, integrate Stripe,
   implement JWT auth. Create Order/Payment models. API endpoints
   should match: /api/orders, /api/payments..."

3. frontend → receives enriched prompt:
   "Build checkout UI. CONTEXT: Backend provides /api/orders and
   /api/payments endpoints. Data models: Order{...}, Payment{...}.
   UI should handle Stripe integration and JWT tokens..."

4. test-writer → receives ALL context:
   "Create tests. CONTEXT: Architecture uses PostgreSQL + Stripe.
   Backend APIs: /api/orders, /api/payments with Order/Payment models.
   Frontend has checkout flow with Stripe integration..."
```

## 📊 Core Components

### 1. GraphBuilder
Analyzes natural language queries to build optimal dependency graphs:

```typescript
const builder = new GraphBuilder();
const result = await builder.buildGraph({
  query: "implement user authentication with social login",
  constraints: { maxNodes: 6, parallelismLevel: "high" }
});
```

**Features:**
- NLP-based complexity analysis
- Automatic agent selection
- Dependency resolution
- Risk factor identification
- Alternative graph generation

### 2. GraphFlowEngine
Executes graphs with neural coordination:

```typescript
const engine = new GraphFlowEngine();
const result = await engine.executeGraph(graph, {
  mode: "neural",
  maxParallel: 3,
  timeout: 900000
});
```

**Features:**
- Topological execution ordering
- Intelligent parallelization
- Neural context propagation
- Real-time progress tracking
- Error recovery and retries

### 3. InputEnricher
Enriches Claude prompts with predecessor context:

```typescript
const enricher = new InputEnricher();
const enrichedPrompt = await enricher.enrichPrompt({
  nodeId: "backend_node",
  agent: "backend",
  baseTask: "Create REST API",
  predecessorOutputs: architectOutputs
});
```

**Features:**
- Agent-specific prompt templates
- Structured context injection
- Neural coordination instructions
- Quality validation
- Multi-level enrichment

### 4. OutputPropagator
Parses outputs and propagates structured data:

```typescript
const propagator = new OutputPropagator();
const result = await propagator.parseAndPropagate(
  nodeId, agent, rawOutput, dependentNodes, sessionId
);
```

**Features:**
- Multi-strategy parsing (JSON, structured text, patterns)
- Network effect analysis
- Quality assessment
- Context optimization
- Dependency enrichment

## 🎮 Interactive Demo

```bash
# Run the interactive demo
tsx examples/graph-neural-demo.ts

# Or try specific examples
import { demoFullStack, demoMicroservices } from './examples/graph-neural-demo.ts';
await demoFullStack();
await demoMicroservices();
```

## 📈 Performance Metrics

The system tracks comprehensive metrics:

```typescript
interface GraphNeuralMetrics {
  totalExecutionTime: number;           // End-to-end execution
  neuralEnrichmentOverhead: number;     // Time spent on context enrichment
  networkEffects: number;               // Dependency impact score
  parallelismUtilization: number;       // Parallel execution efficiency
  dependencyResolutionTime: number;     // Graph analysis time
}
```

## 🔄 Real-Time Visualization

The system provides rich visualization of graph execution:

```typescript
// Stream progress updates
for await (const progress of system.streamProgress(sessionId)) {
  console.log(`Progress: ${progress.completedNodes}/${progress.totalNodes}`);
  console.log(`Current: [${progress.currentNode?.agent}] executing...`);
  console.log(`Quality: ${progress.networkMetrics?.enrichmentQuality * 100}%`);
}
```

## 🎯 Use Cases

### Full-Stack Applications
```typescript
await system.execute({
  query: "Build social media platform with posts, comments, likes, and real-time chat",
  options: { mode: "neural", parallelismLevel: "high" }
});
```

### Microservices Architecture
```typescript
await system.execute({
  query: "Design event-driven microservices for order processing with saga pattern",
  options: { mode: "neural", maxNodes: 12 }
});
```

### Data Processing Pipelines
```typescript
await system.execute({
  query: "Create ETL pipeline for financial data with real-time anomaly detection",
  options: { mode: "neural", parallelismLevel: "medium" }
});
```

## 🧪 Testing and Quality

### Enrichment Quality Validation
```typescript
const validation = enricher.validateEnrichedPrompt(enrichedPrompt);
console.log(`Enrichment quality: ${validation.score}%`);
console.log(`Issues: ${validation.issues.join(', ')}`);
```

### Network Effect Analysis
```typescript
const effects = await propagator.analyzeNetworkEffects(
  parsedOutput, dependentNodes, sessionId
);

effects.forEach(effect => {
  console.log(`${effect.type}: ${effect.description} (${effect.impact} impact)`);
});
```

## 📝 Memory Structure

The system creates a structured memory for each session:

```
.graphyn/graph-memory/
├── session_12345/
│   ├── graph.json                 # Graph structure and metadata
│   ├── architect_node/
│   │   ├── input.json            # Enriched prompt with context
│   │   ├── output.json           # Structured results
│   │   ├── parsed-output.json    # Parsing analysis
│   │   └── status.json           # Execution status
│   ├── backend_node/
│   │   ├── input.json            # Enriched with architect context
│   │   ├── output.json           # API endpoints, data models
│   │   ├── enrichment.json       # Received context from predecessor
│   │   └── status.json
│   └── frontend_node/
│       ├── input.json            # Enriched with backend context
│       ├── output.json           # UI components, user flows
│       └── status.json
```

## 🔧 Configuration Options

### Execution Modes
- **`neural`**: Full neural context enrichment (recommended)
- **`parallel`**: Maximum parallelization with minimal dependencies
- **`sequential`**: Strict sequential execution

### Parallelism Levels
- **`low`**: 1 concurrent node (safe, slow)
- **`medium`**: 2-3 concurrent nodes (balanced)
- **`high`**: 4+ concurrent nodes (fast, requires more resources)

### Quality Settings
```typescript
{
  enrichmentLevel: "comprehensive",    // minimal | moderate | comprehensive
  validationStrict: true,             // Strict quality validation
  retryOnLowQuality: true,           // Retry if enrichment quality < 70%
  maxRetries: 3                      // Maximum execution retries
}
```

## 🚀 Advanced Features

### Custom Agent Templates
```typescript
const enricher = new InputEnricher();
enricher.addCustomTemplate("data-engineer", {
  taskFormat: "Design data pipeline for: {BASE_TASK}",
  contextSections: ["dataFlows", "transformations", "validations"],
  neuralInstructions: "Focus on data quality and pipeline efficiency"
});
```

### Network Effect Prediction
```typescript
const predictor = new NetworkEffectPredictor();
const prediction = await predictor.predictEffects(graph, "add new microservice");
console.log(`Expected impact: ${prediction.impactScore}`);
```

### Dynamic Graph Optimization
```typescript
const optimizer = new GraphOptimizer();
const optimizedGraph = await optimizer.optimize(graph, {
  target: "minimize_execution_time",
  constraints: { maxParallel: 4, memoryLimit: "8GB" }
});
```

## 🛠️ Error Handling

The system includes comprehensive error handling:

```typescript
try {
  const result = await system.execute(request);
} catch (error) {
  if (error instanceof GraphBuildError) {
    console.log("Graph construction failed:", error.analysis);
  } else if (error instanceof NeuralEnrichmentError) {
    console.log("Context enrichment failed:", error.node);
  } else if (error instanceof ExecutionTimeoutError) {
    console.log("Execution timed out:", error.partialResults);
  }
}
```

## 🔮 Future Enhancements

- **Dynamic Graph Modification**: Modify running graphs based on intermediate results
- **Cross-Session Learning**: Learn from previous executions to improve graph building
- **Agent Performance Analytics**: Track and optimize individual agent performance
- **Distributed Execution**: Execute graphs across multiple machines
- **Visual Graph Editor**: GUI for creating and modifying execution graphs
- **Integration with External Tools**: Connect with databases, APIs, and deployment systems

## 💡 Best Practices

1. **Start with Clear Queries**: Detailed queries produce better graphs
2. **Use Appropriate Parallelism**: High parallelism for independent tasks, low for sequential workflows
3. **Monitor Quality Metrics**: Check enrichment quality and network effects
4. **Cache Common Patterns**: Reuse successful graph patterns for similar tasks
5. **Handle Failures Gracefully**: Design graphs with error recovery paths

## 📚 API Reference

Complete API documentation is available in the TypeScript definitions. Key exports:

- `GraphNeuralSystem` - Main orchestration class
- `GraphFlowEngine` - Graph execution engine
- `GraphBuilder` - Dependency graph construction
- `InputEnricher` - Neural prompt enrichment
- `OutputPropagator` - Result parsing and propagation

---

Built with ❤️ for the **@graphyn/code** ecosystem. This system represents the future of AI-powered development coordination.