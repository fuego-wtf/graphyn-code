import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { MultiAgentOrchestrator as Orchestrator } from '../../orchestrator/multi-agent-orchestrator.js';
import { GraphFlowEngine, ExecutionGraph, GraphNode, GraphExecutionProgress } from '../../orchestrator/graph-flow-engine.js';
import { GraphBuilder, GraphBuilderRequest } from '../../orchestrator/graph-builder.js';
import { Loading } from './Loading.js';

interface MultiAgentOrchestratorProps {
  query: string;
  onComplete?: () => void;
  useGraphMode?: boolean;
}

interface TaskProgress {
  id: string;
  description: string;
  agent: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  output?: string;
  error?: string;
  dependencies?: string[];
  startTime?: number;
  endTime?: number;
}

interface GraphVisualization {
  nodes: Map<string, GraphNode>;
  edges: Map<string, string[]>;
  currentlyExecuting: Set<string>;
  completed: Set<string>;
  failed: Set<string>;
}

export const MultiAgentOrchestrator: React.FC<MultiAgentOrchestratorProps> = ({ 
  query, 
  onComplete,
  useGraphMode = true
}) => {
  const [orchestrator] = useState(() => new Orchestrator());
  const [graphEngine] = useState(() => new GraphFlowEngine());
  const [graphBuilder] = useState(() => new GraphBuilder());
  const [tasks, setTasks] = useState<TaskProgress[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<string[]>([]);
  const [graph, setGraph] = useState<ExecutionGraph | null>(null);
  const [graphProgress, setGraphProgress] = useState<GraphExecutionProgress | null>(null);
  const [visualization, setVisualization] = useState<GraphVisualization | null>(null);

  useEffect(() => {
    const startOrchestration = async () => {
      try {
        setIsRunning(true);
        setError(null);
        
        if (useGraphMode) {
          // Graph-Neural Coordination Mode
          setOutput(prev => [...prev, `🧠 Initializing graph-neural coordination...`]);
          
          // Step 1: Build execution graph
          const graphRequest: GraphBuilderRequest = {
            query,
            context: {
              repository: process.cwd(),
              framework: 'detected',
              language: 'typescript'
            },
            constraints: {
              maxNodes: 8,
              parallelismLevel: 'high'
            },
            mode: 'automatic'
          };
          
          const graphResult = await graphBuilder.buildGraph(graphRequest);
          
          if (!graphResult.success || !graphResult.graph) {
            throw new Error(graphResult.error || 'Failed to build execution graph');
          }
          
          setGraph(graphResult.graph);
          setOutput(prev => [...prev, `📊 Generated execution graph with ${graphResult.graph.nodes.size} nodes`]);
          
          // Convert graph nodes to tasks for UI
          const graphTasks: TaskProgress[] = Array.from(graphResult.graph.nodes.entries()).map(([nodeId, node]) => ({
            id: nodeId,
            description: node.task,
            agent: node.agent,
            status: node.status as any,
            dependencies: node.dependencies,
            startTime: node.startTime,
            endTime: node.endTime
          }));
          
          setTasks(graphTasks);
          
          // Initialize visualization
          setVisualization({
            nodes: graphResult.graph.nodes,
            edges: graphResult.graph.edges,
            currentlyExecuting: new Set(),
            completed: new Set(),
            failed: new Set()
          });
          
          // Set up graph engine event listeners
          graphEngine.on('graph_execution_started', (data) => {
            setOutput(prev => [...prev, `🚀 Starting neural graph execution (${data.totalNodes} nodes)`]);
          });
          
          graphEngine.on('node_started', (data) => {
            setTasks(prev => prev.map(task => 
              task.id === data.nodeId 
                ? { ...task, status: 'in_progress', startTime: Date.now() }
                : task
            ));
            setOutput(prev => [...prev, `🔄 [${data.agent}] ${graphResult.graph!.nodes.get(data.nodeId)?.task.substring(0, 60)}...`]);
            
            setVisualization(prev => prev ? {
              ...prev,
              currentlyExecuting: new Set([...prev.currentlyExecuting, data.nodeId])
            } : null);
          });
          
          graphEngine.on('node_completed', (data) => {
            setTasks(prev => prev.map(task => 
              task.id === data.nodeId 
                ? { ...task, status: 'completed', endTime: Date.now(), output: JSON.stringify(data.result) }
                : task
            ));
            setOutput(prev => [...prev, `✅ [${graphResult.graph!.nodes.get(data.nodeId)?.agent}] Task completed with neural enrichment`]);
            
            setVisualization(prev => prev ? {
              ...prev,
              currentlyExecuting: new Set([...prev.currentlyExecuting].filter(id => id !== data.nodeId)),
              completed: new Set([...prev.completed, data.nodeId])
            } : null);
          });
          
          graphEngine.on('node_failed', (data) => {
            setTasks(prev => prev.map(task => 
              task.id === data.nodeId 
                ? { ...task, status: 'failed', error: data.error, endTime: Date.now() }
                : task
            ));
            setOutput(prev => [...prev, `❌ [${graphResult.graph!.nodes.get(data.nodeId)?.agent}] Failed: ${data.error}`]);
            
            setVisualization(prev => prev ? {
              ...prev,
              currentlyExecuting: new Set([...prev.currentlyExecuting].filter(id => id !== data.nodeId)),
              failed: new Set([...prev.failed, data.nodeId])
            } : null);
          });
          
          graphEngine.on('graph_execution_completed', (data) => {
            setIsRunning(false);
            setOutput(prev => [...prev, `🎉 Graph execution completed! Total time: ${data.metrics.totalExecutionTime}ms`]);
            setOutput(prev => [...prev, `📈 Network effects: ${data.metrics.neuralEnrichmentOverhead}ms neural overhead`]);
            
            if (onComplete) {
              setTimeout(onComplete, 2000);
            }
          });
          
          graphEngine.on('graph_execution_failed', (data) => {
            setIsRunning(false);
            setError(`Graph execution failed: ${data.error}`);
          });
          
          // Step 2: Execute the graph with neural coordination
          const result = await graphEngine.executeGraph(graphResult.graph, {
            mode: 'neural',
            timeout: 900000, // 15 minutes
            maxParallel: 3
          });
          
          if (!result.success) {
            throw new Error(result.error || 'Graph execution failed');
          }
          
        } else {
          // Traditional orchestration mode (fallback)
          setOutput(prev => [...prev, `🤖 Starting traditional orchestration...`]);
          
          // Set up traditional event listeners
          orchestrator.on('tasks_generated', (data) => {
            setTasks(data.tasks.map(task => ({
              id: task.id,
              description: task.description,
              agent: task.agent,
              status: task.status as any
            })));
          });

          orchestrator.on('task_started', (data) => {
            setTasks(prev => prev.map(task => 
              task.id === data.task.id 
                ? { ...task, status: 'in_progress' }
                : task
            ));
            setOutput(prev => [...prev, `🚀 Starting: ${data.task.description} (${data.task.agent})`]);
          });

          orchestrator.on('task_completed', (data) => {
            setTasks(prev => prev.map(task => 
              task.id === data.task.id 
                ? { ...task, status: 'completed', output: data.result }
                : task
            ));
            setOutput(prev => [...prev, `✅ Completed: ${data.task.description}`]);
          });

          orchestrator.on('task_failed', (data) => {
            setTasks(prev => prev.map(task => 
              task.id === data.task.id 
                ? { ...task, status: 'failed', error: data.error }
                : task
            ));
            setOutput(prev => [...prev, `❌ Failed: ${data.task.description} - ${data.error}`]);
          });

          orchestrator.on('orchestration_complete', (data) => {
            setIsRunning(false);
            setOutput(prev => [...prev, `🎉 All tasks completed! Results:`]);
            
            // Add final results
            data.results.forEach(result => {
              if (result.success) {
                setOutput(prev => [...prev, `  ✅ ${result.task.agent}: ${result.task.description}`]);
              } else {
                setOutput(prev => [...prev, `  ❌ ${result.task.agent}: ${result.error}`]);
              }
            });

            if (onComplete) {
              setTimeout(onComplete, 2000);
            }
          });

          orchestrator.on('orchestration_failed', (data) => {
            setIsRunning(false);
            setError(data.error);
          });

          // Start traditional orchestration
          await orchestrator.orchestrate({
            query,
            context: {
              repository: process.cwd(),
              framework: 'detected',
              language: 'typescript'
            },
            agents: ['task-dispatcher'],
            mode: 'adaptive'
          });
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        setIsRunning(false);
      }
    };

    startOrchestration();

    // Cleanup
    return () => {
      orchestrator.removeAllListeners();
      graphEngine.removeAllListeners();
    };
  }, [query, orchestrator, graphEngine, graphBuilder, onComplete, useGraphMode]);

  const getStatusIcon = (status: TaskProgress['status']) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'in_progress': return '🔄';
      case 'completed': return '✅';
      case 'failed': return '❌';
      default: return '⏳';
    }
  };

  const getStatusColor = (status: TaskProgress['status']) => {
    switch (status) {
      case 'pending': return 'gray';
      case 'in_progress': return 'yellow';
      case 'completed': return 'green';
      case 'failed': return 'red';
      default: return 'gray';
    }
  };

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">❌ Orchestration Failed</Text>
        <Text color="red">{error}</Text>
        <Box marginTop={1}>
          <Text color="gray">Press ESC to return to menu</Text>
        </Box>
      </Box>
    );
  }

  // Graph visualization component
  const renderGraphVisualization = () => {
    if (!visualization || !graph) return null;

    return (
      <Box flexDirection="column" marginBottom={1} borderStyle="single" borderColor="blue">
        <Box marginBottom={1} paddingX={1}>
          <Text color="blue" bold>🧠 Neural Dependency Graph</Text>
        </Box>
        
        <Box flexDirection="column" paddingX={1}>
          {Array.from(visualization.nodes.entries()).map(([nodeId, node]) => {
            const isExecuting = visualization.currentlyExecuting.has(nodeId);
            const isCompleted = visualization.completed.has(nodeId);
            const isFailed = visualization.failed.has(nodeId);
            
            let nodeColor = 'gray';
            let nodeIcon = '⏳';
            
            if (isFailed) {
              nodeColor = 'red';
              nodeIcon = '❌';
            } else if (isCompleted) {
              nodeColor = 'green';
              nodeIcon = '✅';
            } else if (isExecuting) {
              nodeColor = 'yellow';
              nodeIcon = '🔄';
            }
            
            return (
              <Box key={nodeId} marginBottom={1}>
                <Box marginRight={2}>
                  <Text color={nodeColor}>{nodeIcon}</Text>
                </Box>
                <Box flexDirection="column">
                  <Text color={nodeColor} bold>
                    [{node.agent}] {node.task.substring(0, 50)}...
                  </Text>
                  {node.dependencies.length > 0 && (
                    <Text color="gray" dimColor>
                      ↳ Depends on: {node.dependencies.map(depId => {
                        const depNode = visualization.nodes.get(depId);
                        return depNode ? `${depNode.agent}` : depId.substring(0, 8);
                      }).join(', ')}
                    </Text>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
        
        <Box paddingX={1} marginTop={1}>
          <Text color="cyan">
            Progress: {visualization.completed.size}/{visualization.nodes.size} nodes
          </Text>
          <Box marginLeft={3}>
            <Text color="yellow">Executing: {visualization.currentlyExecuting.size}</Text>
          </Box>
          {visualization.failed.size > 0 && (
            <Box marginLeft={3}>
              <Text color="red">Failed: {visualization.failed.size}</Text>
            </Box>
          )}
        </Box>
      </Box>
    );
  };

  // Render execution metrics
  const renderExecutionMetrics = () => {
    if (!graph || !isRunning) return null;

    const completedTasks = tasks.filter(t => t.status === 'completed');
    const avgExecutionTime = completedTasks.reduce((sum, task) => {
      return sum + ((task.endTime || 0) - (task.startTime || 0));
    }, 0) / Math.max(completedTasks.length, 1);

    return (
      <Box flexDirection="column" marginBottom={1} borderStyle="single" borderColor="cyan">
        <Box marginBottom={1} paddingX={1}>
          <Text color="cyan" bold>📊 Neural Coordination Metrics</Text>
        </Box>
        
        <Box flexDirection="column" paddingX={1}>
          <Text>
            <Text color="green">Parallel Efficiency: </Text>
            <Text>{Math.round((visualization?.currentlyExecuting.size || 0) / Math.max(tasks.filter(t => t.status === 'pending').length, 1) * 100)}%</Text>
          </Text>
          <Text>
            <Text color="blue">Avg Node Time: </Text>
            <Text>{Math.round(avgExecutionTime / 1000)}s</Text>
          </Text>
          <Text>
            <Text color="yellow">Context Enrichment: </Text>
            <Text>Active</Text>
          </Text>
        </Box>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text color="blue" bold>
          {useGraphMode ? '🧠 Graph-Neural AI Squad' : '🤖 Multi-Agent Squad'}
        </Text>
      </Box>
      
      <Box marginBottom={1}>
        <Text color="cyan">Query: </Text>
        <Text>{query}</Text>
      </Box>

      {tasks.length === 0 && isRunning && (
        <Box marginBottom={1}>
          <Loading message={useGraphMode ? "Building neural dependency graph..." : "Analyzing query and generating tasks..."} />
        </Box>
      )}

      {/* Graph visualization (only in graph mode) */}
      {useGraphMode && visualization && renderGraphVisualization()}
      
      {/* Execution metrics (only in graph mode) */}
      {useGraphMode && renderExecutionMetrics()}

      {/* Traditional task list (always shown) */}
      {tasks.length > 0 && !useGraphMode && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="yellow" bold>📋 Task Plan:</Text>
          {tasks.map((task, index) => (
            <Box key={task.id} marginLeft={2}>
              <Text color={getStatusColor(task.status)}>
                {getStatusIcon(task.status)} {index + 1}. [{task.agent}] {task.description}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {output.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="green" bold>📺 Live Output:</Text>
          <Box flexDirection="column" marginLeft={2}>
            {output.slice(-8).map((line, index) => (
              <Text key={index}>{line}</Text>
            ))}
          </Box>
        </Box>
      )}

      {isRunning && (
        <Box marginTop={1}>
          <Text color="gray">
            ⏳ {useGraphMode ? 'Neural graph execution' : 'Orchestration'} in progress... Press ESC to cancel
          </Text>
        </Box>
      )}

      {!isRunning && tasks.length > 0 && !error && (
        <Box marginTop={1}>
          <Text color="green">
            ✨ {useGraphMode ? 'Neural coordination' : 'Orchestration'} complete! Press ESC to return to menu
          </Text>
        </Box>
      )}
    </Box>
  );
};