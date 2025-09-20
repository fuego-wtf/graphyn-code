/**
 * Agent Tool System
 *
 * Provides real file system, bash, and MCP tool integrations for agents
 */
import { EventEmitter } from 'events';
export interface Tool {
    name: string;
    description: string;
    input_schema: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
}
export interface ToolExecutionResult {
    success: boolean;
    result?: any;
    error?: string;
    output?: string;
}
export declare class AgentToolSystem extends EventEmitter {
    private workingDirectory;
    private allowedPaths;
    constructor(workingDirectory?: string);
    getAvailableTools(): Tool[];
    executeTool(toolName: string, input: any): Promise<ToolExecutionResult>;
    private writeFile;
    private readFile;
    private executeBashCommand;
    private listFiles;
    private listFilesRecursive;
    private createDirectory;
    private resolvePath;
    private isPathAllowed;
    addAllowedPath(pathToAdd: string): void;
    getWorkingDirectory(): string;
    setWorkingDirectory(newDirectory: string): void;
}
export default AgentToolSystem;
//# sourceMappingURL=agent-tool-system.d.ts.map