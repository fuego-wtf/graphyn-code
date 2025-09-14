/**
 * Context7 Integration - Deep Project Understanding
 * 
 * Integrates Context7-style deep context analysis to understand project
 * architecture, technologies, workflows, and generate intelligent task plans.
 */

import { detectTechStack, type TechStackContext, type FrameworkInfo } from './detector.js';
import { RepositoryAnalyzer } from '../services/repository-analyzer.js';
import path from 'path';
import { promises as fs } from 'fs';

export interface ProjectArchitecture {
  type: 'monolith' | 'microservices' | 'modular' | 'library' | 'cli' | 'mixed';
  services: Array<{
    name: string;
    path: string;
    type: string;
    dependencies: string[];
  }>;
  dataFlow: Array<{
    from: string;
    to: string;
    type: 'api' | 'database' | 'message_queue' | 'event';
  }>;
  entryPoints: string[];
  buildSystems: string[];
}

export interface DevelopmentWorkflow {
  testingStrategy: 'unit' | 'integration' | 'e2e' | 'mixed';
  deploymentPattern: 'container' | 'serverless' | 'traditional' | 'static';
  cicdPipeline: boolean;
  codeQuality: {
    linting: boolean;
    formatting: boolean;
    typeChecking: boolean;
  };
  gitWorkflow: 'gitflow' | 'github-flow' | 'gitlab-flow' | 'trunk';
}

export interface ProjectContext {
  // Basic project info
  name: string;
  rootPath: string;
  
  // Technology analysis (enhanced from existing detector)
  techStack: TechStackContext;
  
  // Architecture understanding
  architecture: ProjectArchitecture;
  
  // Development patterns
  workflow: DevelopmentWorkflow;
  
  // Capability analysis
  capabilities: {
    canBuild: boolean;
    canTest: boolean;
    canDeploy: boolean;
    hasDocumentation: boolean;
    hasExamples: boolean;
  };
  
  // Recommended agent specializations
  recommendedAgents: Array<{
    type: string;
    specialization: string;
    confidence: number;
    reasoning: string;
  }>;
  
  // Task planning hints
  taskPatterns: {
    typical: string[];
    complex: string[];
    infrastructure: string[];
  };
}

export class Context7Analyzer {
  private repositoryAnalyzer: RepositoryAnalyzer;
  
  constructor() {
    this.repositoryAnalyzer = new RepositoryAnalyzer();
  }
  
  /**
   * Perform deep analysis of project context
   */
  async analyzeProject(rootPath: string): Promise<ProjectContext> {
    console.log(`🔍 Analyzing project context: ${rootPath}`);
    
    // Phase 1: Basic tech stack detection
    const techStack = await detectTechStack(rootPath);
    
    // Phase 2: Repository structure analysis
    const repoAnalysis = await this.repositoryAnalyzer.analyze({
      path: rootPath,
      includePatterns: ['**/*.{js,ts,py,go,rs,java,php,rb,swift,kt}'],
      excludePatterns: ['node_modules/**', '.git/**', 'dist/**', 'build/**']
    });
    
    // Phase 3: Architecture detection
    const architecture = await this.detectArchitecture(rootPath, techStack);
    
    // Phase 4: Workflow analysis
    const workflow = await this.analyzeWorkflow(rootPath, techStack);
    
    // Phase 5: Capabilities assessment
    const capabilities = await this.assessCapabilities(rootPath, techStack);
    
    // Phase 6: Agent recommendations
    const recommendedAgents = this.recommendAgents(techStack, architecture, workflow);
    
    // Phase 7: Task pattern analysis
    const taskPatterns = this.analyzeTaskPatterns(techStack, architecture, workflow);
    
    return {
      name: path.basename(rootPath),
      rootPath,
      techStack,
      architecture,
      workflow,
      capabilities,
      recommendedAgents,
      taskPatterns
    };
  }
  
  /**
   * Detect project architecture patterns
   */
  private async detectArchitecture(
    rootPath: string, 
    techStack: TechStackContext
  ): Promise<ProjectArchitecture> {
    const services: ProjectArchitecture['services'] = [];
    const entryPoints: string[] = [];
    const buildSystems: string[] = [];
    
    // Detect services based on directory structure
    const subDirs = await this.findSubDirectories(rootPath);
    
    for (const dir of subDirs) {
      const dirPath = path.join(rootPath, dir);
      const hasPackageJson = await this.fileExists(path.join(dirPath, 'package.json'));
      const hasGoMod = await this.fileExists(path.join(dirPath, 'go.mod'));
      const hasPyProject = await this.fileExists(path.join(dirPath, 'pyproject.toml'));
      
      if (hasPackageJson || hasGoMod || hasPyProject) {
        services.push({
          name: dir,
          path: dirPath,
          type: this.inferServiceType(dir, techStack),
          dependencies: [] // TODO: Analyze dependencies
        });
      }
    }
    
    // Detect entry points
    const commonEntryPoints = [
      'main.js', 'index.js', 'app.js', 'server.js',
      'main.ts', 'index.ts', 'app.ts', 'server.ts',
      'main.py', '__main__.py', 'app.py',
      'main.go', 'cmd/main.go',
      'Main.java', 'Application.java'
    ];
    
    for (const entry of commonEntryPoints) {
      if (await this.fileExists(path.join(rootPath, entry))) {
        entryPoints.push(entry);
      }
    }
    
    // Detect build systems
    if (await this.fileExists(path.join(rootPath, 'package.json'))) {
      buildSystems.push('npm/yarn');
    }
    if (await this.fileExists(path.join(rootPath, 'Dockerfile'))) {
      buildSystems.push('docker');
    }
    if (await this.fileExists(path.join(rootPath, 'Makefile'))) {
      buildSystems.push('make');
    }
    if (await this.fileExists(path.join(rootPath, 'build.gradle'))) {
      buildSystems.push('gradle');
    }
    
    // Determine architecture type
    let type: ProjectArchitecture['type'] = 'monolith';
    if (services.length > 3) {
      type = 'microservices';
    } else if (services.length > 1) {
      type = 'modular';
    }
    
    return {
      type,
      services,
      dataFlow: [], // TODO: Analyze API calls and data flow
      entryPoints,
      buildSystems
    };
  }
  
  /**
   * Analyze development workflow patterns
   */
  private async analyzeWorkflow(
    rootPath: string,
    techStack: TechStackContext
  ): Promise<DevelopmentWorkflow> {
    // Test strategy analysis
    let testingStrategy: DevelopmentWorkflow['testingStrategy'] = 'unit';
    const hasJest = techStack.frameworks.some(f => f.name.includes('jest'));
    const hasCypress = await this.fileExists(path.join(rootPath, 'cypress.config.js'));
    const hasE2E = await this.directoryExists(path.join(rootPath, 'e2e'));
    
    if (hasCypress || hasE2E) {
      testingStrategy = 'e2e';
    } else if (hasJest) {
      testingStrategy = hasE2E ? 'mixed' : 'integration';
    }
    
    // Deployment pattern
    let deploymentPattern: DevelopmentWorkflow['deploymentPattern'] = 'traditional';
    if (await this.fileExists(path.join(rootPath, 'Dockerfile'))) {
      deploymentPattern = 'container';
    } else if (await this.fileExists(path.join(rootPath, 'serverless.yml'))) {
      deploymentPattern = 'serverless';
    } else if (techStack.frameworks.some(f => 
      ['next', 'gatsby', 'nuxt', 'vite'].includes(f.name.toLowerCase())
    )) {
      deploymentPattern = 'static';
    }
    
    // CI/CD detection
    const cicdPipeline = await this.fileExists(path.join(rootPath, '.github/workflows')) ||
                         await this.fileExists(path.join(rootPath, '.gitlab-ci.yml')) ||
                         await this.fileExists(path.join(rootPath, 'azure-pipelines.yml'));
    
    // Code quality
    const codeQuality = {
      linting: techStack.conventions?.linter !== undefined,
      formatting: techStack.conventions?.formatter !== undefined,
      typeChecking: techStack.frameworks.some(f => f.name.includes('typescript'))
    };
    
    return {
      testingStrategy,
      deploymentPattern,
      cicdPipeline,
      codeQuality,
      gitWorkflow: 'github-flow' // Default, could be enhanced
    };
  }
  
  /**
   * Assess project capabilities
   */
  private async assessCapabilities(
    rootPath: string,
    techStack: TechStackContext
  ): Promise<ProjectContext['capabilities']> {
    const packageJsonExists = await this.fileExists(path.join(rootPath, 'package.json'));
    let canBuild = false;
    let canTest = false;
    
    if (packageJsonExists) {
      const packageJson = JSON.parse(
        await fs.readFile(path.join(rootPath, 'package.json'), 'utf-8')
      );
      canBuild = !!packageJson.scripts?.build;
      canTest = !!packageJson.scripts?.test;
    }
    
    return {
      canBuild: canBuild || techStack.frameworks.length > 0,
      canTest: canTest || techStack.frameworks.some(f => 
        f.name.includes('test') || f.name.includes('jest') || f.name.includes('mocha')
      ),
      canDeploy: await this.fileExists(path.join(rootPath, 'Dockerfile')) ||
                 await this.fileExists(path.join(rootPath, '.github/workflows')),
      hasDocumentation: await this.fileExists(path.join(rootPath, 'README.md')) ||
                        await this.directoryExists(path.join(rootPath, 'docs')),
      hasExamples: await this.directoryExists(path.join(rootPath, 'examples')) ||
                   await this.directoryExists(path.join(rootPath, 'samples'))
    };
  }
  
  /**
   * Recommend specialized agents based on context
   */
  private recommendAgents(
    techStack: TechStackContext,
    architecture: ProjectArchitecture,
    workflow: DevelopmentWorkflow
  ): ProjectContext['recommendedAgents'] {
    const recommendations: ProjectContext['recommendedAgents'] = [];
    
    // Frontend agents
    const frontendFramework = techStack.frameworks.find(f => 
      ['react', 'vue', 'angular', 'svelte'].includes(f.name.toLowerCase())
    );
    if (frontendFramework) {
      recommendations.push({
        type: 'frontend',
        specialization: frontendFramework.name,
        confidence: frontendFramework.confidence,
        reasoning: `Detected ${frontendFramework.name} frontend framework`
      });
    }
    
    // Backend agents
    const backendFramework = techStack.frameworks.find(f => 
      ['express', 'fastify', 'django', 'flask', 'rails'].includes(f.name.toLowerCase())
    );
    if (backendFramework) {
      recommendations.push({
        type: 'backend',
        specialization: backendFramework.name,
        confidence: backendFramework.confidence,
        reasoning: `Detected ${backendFramework.name} backend framework`
      });
    }
    
    // Database agents
    if (techStack.databases.length > 0) {
      recommendations.push({
        type: 'database',
        specialization: techStack.databases[0].type,
        confidence: 0.8,
        reasoning: `Detected ${techStack.databases[0].type} database`
      });
    }
    
    // Testing agents
    if (workflow.testingStrategy !== 'unit') {
      recommendations.push({
        type: 'test-writer',
        specialization: workflow.testingStrategy,
        confidence: 0.7,
        reasoning: `Project uses ${workflow.testingStrategy} testing strategy`
      });
    }
    
    // DevOps agents
    if (workflow.deploymentPattern === 'container') {
      recommendations.push({
        type: 'devops',
        specialization: 'docker',
        confidence: 0.8,
        reasoning: 'Project uses containerized deployment'
      });
    }
    
    // Architecture agent for complex projects
    if (architecture.type === 'microservices' || architecture.services.length > 3) {
      recommendations.push({
        type: 'architect',
        specialization: 'distributed-systems',
        confidence: 0.9,
        reasoning: 'Complex architecture requires architectural guidance'
      });
    }
    
    return recommendations;
  }
  
  /**
   * Analyze common task patterns for this project type
   */
  private analyzeTaskPatterns(
    techStack: TechStackContext,
    architecture: ProjectArchitecture,
    workflow: DevelopmentWorkflow
  ): ProjectContext['taskPatterns'] {
    const typical = [
      'Add new feature',
      'Fix bug',
      'Update dependencies',
      'Improve performance',
      'Add tests'
    ];
    
    const complex = [
      'Refactor architecture',
      'Add authentication',
      'Implement caching',
      'Scale infrastructure',
      'Migrate database'
    ];
    
    const infrastructure = [
      'Setup CI/CD',
      'Configure monitoring',
      'Optimize build process',
      'Setup deployment pipeline',
      'Add security measures'
    ];
    
    // Customize based on detected patterns
    if (techStack.frameworks.some(f => f.category === 'frontend')) {
      typical.push('Update UI components', 'Add responsive design');
      complex.push('Implement state management', 'Add PWA features');
    }
    
    if (techStack.frameworks.some(f => f.category === 'backend')) {
      typical.push('Add API endpoint', 'Update database schema');
      complex.push('Implement microservices', 'Add message queuing');
    }
    
    return { typical, complex, infrastructure };
  }
  
  // Helper methods
  private async findSubDirectories(dirPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
        .map(entry => entry.name);
    } catch {
      return [];
    }
  }
  
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
  
  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }
  
  private inferServiceType(dirName: string, techStack: TechStackContext): string {
    const name = dirName.toLowerCase();
    
    if (name.includes('api') || name.includes('server') || name.includes('backend')) {
      return 'backend';
    }
    if (name.includes('frontend') || name.includes('ui') || name.includes('web')) {
      return 'frontend';
    }
    if (name.includes('db') || name.includes('database')) {
      return 'database';
    }
    if (name.includes('auth')) {
      return 'authentication';
    }
    
    // Infer from tech stack
    if (techStack.frameworks.some(f => f.category === 'backend')) {
      return 'service';
    }
    
    return 'module';
  }
}

// Export utility functions
export async function analyzeProjectContext(rootPath: string): Promise<ProjectContext> {
  const analyzer = new Context7Analyzer();
  return analyzer.analyzeProject(rootPath);
}
