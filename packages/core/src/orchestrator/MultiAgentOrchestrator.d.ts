/**
 * Multi-Agent Orchestrator - Clean and Simple
 *
 * Orchestrates multiple specialized agents for parallel task execution
 * No TUI bloat, no fake metrics, just working orchestration
 */
interface ExecutionResult {
    agentId: string;
    agentType: string;
    success: boolean;
    output: string;
    duration: number;
    tokensUsed: number;
    error?: string;
}
export declare class MultiAgentOrchestrator {
    private agentRegistry;
    private agents;
    private startTime;
    executeQuery(query: string): Promise<ExecutionResult[]>;
    private decomposeQuery;
    private createAgentsForTasks;
    private executeTasksWithDependencies;
    private executeAgentTask;
}
export {};
//# sourceMappingURL=MultiAgentOrchestrator.d.ts.map