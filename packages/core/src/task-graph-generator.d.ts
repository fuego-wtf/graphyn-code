/**
 * Intelligent Task Graph Generator
 *
 * Uses Claude to analyze goals and repository context to generate smart, actionable task graphs
 */
import { ClaudeAPIWrapper } from './claude-api-wrapper.js';
import { RepoAnalysis } from './repo-analyzer.js';
export interface Task {
    id: string;
    description: string;
    type: 'analysis' | 'implementation' | 'testing' | 'security' | 'deployment' | 'documentation';
    dependencies: string[];
    workingDirectory: string;
    priority: number;
    estimatedDuration: number;
    requiredSkills: string[];
    deliverables: string[];
    acceptanceCriteria: string[];
}
export interface TaskGraph {
    tasks: Task[];
    dependencies: Map<string, string[]>;
    criticalPath: string[];
    estimatedTotalDuration: number;
    parallelizationFactor: number;
}
export interface Goal {
    type: string;
    description: string;
    complexity: 'low' | 'medium' | 'high';
    urgency: 'low' | 'medium' | 'high';
    scope: 'feature' | 'refactor' | 'bugfix' | 'optimization' | 'migration';
    constraints: string[];
    requirements: string[];
}
export declare class IntelligentTaskGraphGenerator {
    private claudeAPI;
    constructor(claudeAPI?: ClaudeAPIWrapper);
    generateTaskGraph(goal: Goal, repoAnalysis: RepoAnalysis, workingDirectory: string): Promise<TaskGraph>;
    private generateIntelligentBreakdown;
    private generateContextualTaskBreakdown;
    private buildTaskGraph;
    private generateFallbackTaskGraph;
    private calculateParallelization;
}
export default IntelligentTaskGraphGenerator;
//# sourceMappingURL=task-graph-generator.d.ts.map