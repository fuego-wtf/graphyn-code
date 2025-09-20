/**
 * Claude Code Headless Multi-Agent Orchestrator
 *
 * Uses Claude Code's headless mode with streaming for real-time agent coordination
 * Inspired by claude-squad pattern with mission control interface
 */
import { EventEmitter } from 'events';
import 'dotenv/config';
export declare class GraphynOrchestrator extends EventEmitter {
    private agents;
    private taskGraph;
    private missionControl;
    private workingDirectory;
    private repoAnalysis;
    private repoAnalyzer;
    private taskGraphGenerator;
    constructor(workingDirectory?: string);
    orchestrate(query: string): Promise<any>;
    private analyzeRepository;
    private scanDirectoryStructure;
    private parseGoal;
    private buildTaskGraph;
    private determineAgentSet;
    private buildAgentSet;
    private assignTasks;
    private executeWithMissionControl;
    private spawnAndWatchAgent;
    private requestHumanFeedback;
}
//# sourceMappingURL=GraphynOrchestrator.d.ts.map