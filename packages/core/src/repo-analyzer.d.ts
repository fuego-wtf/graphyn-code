/**
 * Intelligent Repository Analyzer
 *
 * Uses Claude to deeply analyze repository structure, technology stack, and patterns
 */
import { ClaudeAPIWrapper } from './claude-api-wrapper.js';
export interface RepoAnalysis {
    structure: {
        directories: string[];
        keyFiles: string[];
        totalFiles: number;
        codebaseSize: 'small' | 'medium' | 'large' | 'huge';
    };
    technology: {
        primaryLanguages: string[];
        frameworks: string[];
        databases: string[];
        buildTools: string[];
        packageManagers: string[];
        techStack: string;
    };
    patterns: {
        architecture: string;
        designPatterns: string[];
        codeOrganization: string;
        testingStrategy: string;
    };
    dependencies: {
        production: Record<string, string>;
        development: Record<string, string>;
        outdated: string[];
        security: string[];
    };
    complexity: {
        score: number;
        factors: string[];
        recommendations: string[];
    };
    context: {
        projectType: string;
        developmentStage: string;
        teamSize: 'solo' | 'small' | 'medium' | 'large' | 'unknown';
        documentation: 'poor' | 'basic' | 'good' | 'excellent';
    };
}
export declare class IntelligentRepoAnalyzer {
    private claudeAPI;
    private workingDirectory;
    private maxFilesToAnalyze;
    private maxFileSize;
    constructor(workingDirectory: string, claudeAPI?: ClaudeAPIWrapper);
    analyzeRepository(): Promise<RepoAnalysis>;
    private analyzeStructure;
    private detectTechnology;
    private analyzePatterns;
    private analyzeDependencies;
    private assessComplexity;
    private understandContext;
    private isKeyFile;
    private basicAnalysis;
}
export default IntelligentRepoAnalyzer;
//# sourceMappingURL=repo-analyzer.d.ts.map