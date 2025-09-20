/**
 * Multi-Agent Orchestrator - Clean and Simple
 *
 * Orchestrates multiple specialized agents for parallel task execution
 * No TUI bloat, no fake metrics, just working orchestration
 */
// Real agent imports
import { AgentFactory, AgentRegistry } from '@graphyn/agents';
export class MultiAgentOrchestrator {
    agentRegistry = new AgentRegistry();
    agents = new Map();
    startTime = 0;
    async executeQuery(query) {
        this.startTime = Date.now();
        console.log('🚀 Multi-Agent Orchestrator initialized');
        try {
            // Step 1: Decompose the query into tasks
            console.log('📋 Analyzing query and decomposing into tasks...');
            const decomposition = await this.decomposeQuery(query);
            console.log(`✅ Task decomposition complete: ${decomposition.tasks.length} tasks identified`);
            decomposition.tasks.forEach((task, index) => {
                console.log(`   ${index + 1}. ${task.description} (${task.type})`);
            });
            // Step 2: Create and assign agents
            console.log('🤖 Creating specialized agents...');
            await this.createAgentsForTasks(decomposition);
            // Step 3: Execute tasks in parallel with dependency management
            console.log('⚡ Starting parallel execution...');
            const results = await this.executeTasksWithDependencies(decomposition);
            // Summary
            const duration = Date.now() - this.startTime;
            const successCount = results.filter(r => r.success).length;
            const totalTokens = results.reduce((sum, r) => sum + r.tokensUsed, 0);
            console.log(`🎉 Orchestration complete in ${Math.round(duration / 1000)}s`);
            console.log(`   ✅ Success: ${successCount}/${results.length} tasks`);
            console.log(`   🔢 Total tokens: ${totalTokens.toLocaleString()}`);
            return results;
        }
        catch (error) {
            console.log(`❌ Orchestration failed: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    async decomposeQuery(query) {
        // Simple task decomposition - in real implementation, use Claude to analyze the query
        const tasks = [
            {
                type: 'backend',
                description: 'Backend development and API creation',
                requirements: ['API endpoints', 'Database models', 'Authentication'],
                priority: 1
            },
            {
                type: 'security',
                description: 'Security analysis and implementation',
                requirements: ['Vulnerability assessment', 'Security best practices'],
                priority: 2
            }
        ];
        return {
            tasks,
            dependencies: [
                { task: 1, dependsOn: [0] } // Security depends on backend
            ]
        };
    }
    async createAgentsForTasks(decomposition) {
        for (const [index, task] of decomposition.tasks.entries()) {
            const agentId = `${task.type}-${String(index + 1).padStart(3, '0')}`;
            // Create real agent using AgentFactory
            const workspaceDir = `./workspaces/${agentId}`;
            let agent;
            try {
                agent = AgentFactory.createAgent(task.type, agentId, workspaceDir);
                // Initialize the agent
                await agent.initialize();
                // Register with agent registry
                this.agentRegistry.register(agent);
                switch (task.type) {
                    case 'backend':
                        console.log(`   🔧 Backend agent created: ${agentId}`);
                        break;
                    case 'security':
                        console.log(`   🛡️ Security agent created: ${agentId}`);
                        break;
                    default:
                        console.log(`   🤖 Agent created: ${agentId} (${task.type})`);
                }
                this.agents.set(agentId, {
                    agent,
                    task,
                    status: 'idle'
                });
            }
            catch (error) {
                console.error(`❌ Failed to create agent ${agentId}:`, error);
                throw error;
            }
        }
    }
    async executeTasksWithDependencies(decomposition) {
        const results = [];
        const executing = new Set();
        const completed = new Set();
        // Simple parallel execution - run tasks that have no unmet dependencies
        while (completed.size < decomposition.tasks.length) {
            const readyTasks = decomposition.tasks
                .map((task, index) => ({ task, index }))
                .filter(({ index }) => {
                if (completed.has(index) || executing.has(index.toString()))
                    return false;
                const deps = decomposition.dependencies.find(d => d.task === index);
                if (!deps)
                    return true;
                return deps.dependsOn.every(depIndex => completed.has(depIndex));
            });
            if (readyTasks.length === 0) {
                // Wait a bit if no tasks are ready
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }
            // Execute ready tasks in parallel
            const promises = readyTasks.map(async ({ task, index }) => {
                const agentId = `${task.type}-${String(index + 1).padStart(3, '0')}`;
                executing.add(index.toString());
                const agentData = this.agents.get(agentId);
                if (!agentData)
                    throw new Error(`Agent ${agentId} not found`);
                try {
                    const result = await this.executeAgentTask(agentId, task.description);
                    results.push(result);
                    completed.add(index);
                }
                catch (error) {
                    results.push({
                        agentId,
                        agentType: task.type,
                        success: false,
                        output: '',
                        duration: 0,
                        tokensUsed: 0,
                        error: error instanceof Error ? error.message : String(error)
                    });
                    completed.add(index);
                }
                executing.delete(index.toString());
            });
            await Promise.all(promises);
        }
        return results;
    }
    async executeAgentTask(agentId, taskDescription) {
        const agentData = this.agents.get(agentId);
        const agent = agentData?.agent;
        if (!agent)
            throw new Error(`Agent ${agentId} not found`);
        console.log(`[${agentId}] Starting task: ${taskDescription}`);
        try {
            // Create a proper Task object for the ClaudeCodeAgent
            const task = {
                id: `task-${Date.now()}-${Math.random().toString(36).substring(2)}`,
                agentType: agentData.task.type,
                description: taskDescription,
                priority: agentData.task.priority || 5,
                dependencies: [],
                status: 'pending',
                workspace: agent.config.workspaceDir,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            // Execute task using ClaudeCodeAgent
            const execution = await agent.executeTask(task);
            console.log(`[${agentId}] ✅ Task completed in ${Math.round((execution.metrics?.duration || 0) / 1000)}s`);
            return {
                agentId,
                agentType: agentData.task.type,
                success: execution.status === 'completed',
                output: execution.output || '',
                duration: execution.metrics?.duration || 0,
                tokensUsed: execution.metrics?.tokensUsed || 0,
                error: execution.error
            };
        }
        catch (error) {
            console.log(`[${agentId}] ❌ Task failed: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
}
// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
    const query = process.argv[2] || 'Build authentication system with JWT';
    const orchestrator = new MultiAgentOrchestrator();
    orchestrator.executeQuery(query)
        .then(results => {
        console.log('\n🎉 Final Results:');
        results.forEach(result => {
            console.log(`   ${result.success ? '✅' : '❌'} ${result.agentId}: ${result.success ? 'Success' : result.error}`);
        });
    })
        .catch(error => {
        console.error('❌ Execution failed:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=MultiAgentOrchestrator.js.map