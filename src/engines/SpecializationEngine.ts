/**
 * Specialization Engine - Dynamic Agent Creation with Technology Matching
 * 
 * Creates specialized agents dynamically per user/repo based on:
 * - Project technology stack analysis
 * - Framework detection and versioning
 * - API service integration (Figma, GitHub, etc.)
 * - Confidence scoring and specialization matching
 */

import { promises as fs } from 'fs';
import path from 'path';
import { type ProjectContext } from '../context/context7-integration.js';
import { type AgentType } from '../orchestrator/types.js';
import { DynamicAgentRegistry, type AgentProfile, type AgentSpecialization, type AgentMatch } from '../agents/DynamicAgentRegistry.js';

export interface TechnologyProfile {
  name: string;
  version?: string;
  confidence: number;
  category: 'framework' | 'language' | 'database' | 'deployment' | 'testing' | 'api';
  dependencies?: string[];
  patterns: string[];
  expertise_level: 'basic' | 'intermediate' | 'expert';
}

export interface ProjectAnalysis {
  repository: {
    name: string;
    path: string;
    git_branch: string;
    remote_urls: string[];
    primary_language: string;
  };
  technologies: TechnologyProfile[];
  architecture: {
    type: 'monolith' | 'microservices' | 'serverless' | 'hybrid';
    patterns: string[];
    complexity_score: number;
  };
  api_integrations: {
    figma: boolean;
    github: boolean;
    oauth_providers: string[];
    external_apis: string[];
  };
  development_workflow: {
    testing_framework: string[];
    ci_cd_tools: string[];
    deployment_targets: string[];
    package_managers: string[];
  };
}

export interface SpecializedAgentConfig {
  base_agent: AgentProfile;
  specializations: AgentSpecialization[];
  confidence_score: number;
  reasoning: string;
  technology_match: TechnologyProfile[];
  enhanced_capabilities: string[];
  custom_tools: string[];
  specialized_prompts: {
    system: string;
    context: string;
    examples: string[];
  };
  mcp_servers?: Record<string, any>;
  mcp_enabled_tools?: string[];
}

export class SpecializationEngine {
  private agentRegistry: DynamicAgentRegistry;
  private specializationCache = new Map<string, SpecializedAgentConfig[]>();
  
  constructor() {
    this.agentRegistry = new DynamicAgentRegistry();
  }

  /**
   * Initialize the specialization engine
   */
  async initialize(): Promise<void> {
    console.log('🔧 Initializing Specialization Engine...');
    await this.agentRegistry.initialize();
    await this.loadTechnologySpecializations();
    console.log('✅ Specialization Engine ready');
  }

  /**
   * PHASE 1: Deep Project Analysis (Steps 1-15)
   */
  async analyzeProject(workingDirectory: string): Promise<ProjectAnalysis> {
    console.log('🔍 Phase 1: Deep Project Analysis (Steps 1-15)');
    
    const analysis: ProjectAnalysis = {
      repository: await this.analyzeRepository(workingDirectory),
      technologies: await this.detectTechnologies(workingDirectory),
      architecture: await this.analyzeArchitecture(workingDirectory),
      api_integrations: await this.detectApiIntegrations(workingDirectory),
      development_workflow: await this.analyzeWorkflow(workingDirectory)
    };

    console.log('📊 Project Analysis Complete:');
    console.log(`  • Primary Language: ${analysis.repository.primary_language}`);
    console.log(`  • Architecture: ${analysis.architecture.type} (complexity: ${analysis.architecture.complexity_score})`);
    console.log(`  • Technologies: ${analysis.technologies.length} detected`);
    console.log(`  • API Integrations: Figma(${analysis.api_integrations.figma}), GitHub(${analysis.api_integrations.github})`);

    return analysis;
  }

  /**
   * PHASE 2: Dynamic Agent Specialization (Steps 16-30)
   */
  async createSpecializedAgents(analysis: ProjectAnalysis, userQuery: string): Promise<SpecializedAgentConfig[]> {
    console.log('🤖 Phase 2: Dynamic Agent Specialization (Steps 16-30)');
    
    // Step 16-18: Base agent selection and technology matching
    const candidateAgents = await this.selectCandidateAgents(analysis, userQuery);
    
    // Step 19-24: Technology specialization and confidence scoring
    const specializedAgents: SpecializedAgentConfig[] = [];
    
    for (const candidate of candidateAgents) {
      const specialization = await this.applyTechnologySpecialization(candidate, analysis, userQuery);
      // 🔥 LOWERED THRESHOLD: 0.4 instead of 0.6 to allow more agents through
      if (specialization.confidence_score > 0.4) {
        specializedAgents.push(specialization);
      } else {
        console.log(`⚠️ Agent ${candidate.name} scored ${specialization.confidence_score.toFixed(2)}, below 0.4 threshold`);
      }
    }

    // Step 25-30: Capability enhancement and tool assignment
    for (const agent of specializedAgents) {
      await this.enhanceAgentCapabilities(agent, analysis);
      await this.assignSpecializedTools(agent, analysis);
      await this.generateSpecializedPrompts(agent, analysis, userQuery);
    }

    // Sort by confidence and select top 8 agents
    const topAgents = specializedAgents
      .sort((a, b) => b.confidence_score - a.confidence_score)
      .slice(0, 8);

    console.log('🚀 Specialized Agents Created:');
    for (const agent of topAgents) {
      console.log(`  • ${agent.base_agent.name} (${agent.confidence_score.toFixed(2)}) - ${agent.reasoning}`);
    }

    return topAgents;
  }

  /**
   * PHASE 3: Advanced Integration (Steps 31-45)
   */
  async setupAdvancedIntegrations(agents: SpecializedAgentConfig[], analysis: ProjectAnalysis): Promise<void> {
    console.log('🔗 Phase 3: Advanced Integration (Steps 31-45)');
    
    // Steps 31-35: API Integration Setup
    if (analysis.api_integrations.figma) {
      await this.setupFigmaIntegration(agents);
    }
    
    if (analysis.api_integrations.github) {
      await this.setupGitHubIntegration(agents);
    }

    // Steps 36-40: OAuth and External API Configuration
    for (const provider of analysis.api_integrations.oauth_providers) {
      await this.setupOAuthProvider(agents, provider);
    }

    // Steps 41-45: Multi-agent coordination setup
    await this.setupAgentCoordination(agents, analysis);
  }

  /**
   * PHASE 4: Execution Orchestration (Steps 46-60)
   */
  async orchestrateExecution(
    agents: SpecializedAgentConfig[], 
    analysis: ProjectAnalysis, 
    userQuery: string
  ): Promise<void> {
    console.log('⚡ Phase 4: Execution Orchestration (Steps 46-60)');
    
    // Steps 46-50: Task decomposition and agent assignment
    const taskGraph = await this.createTaskGraph(userQuery, agents, analysis);
    
    // Steps 51-55: Parallel execution with dependency management
    await this.executeTaskGraph(taskGraph, agents);
    
    // Steps 56-60: Real-time monitoring and coordination
    await this.monitorExecution(agents, taskGraph);
  }

  /**
   * PHASE 5: Enhanced User Experience (Steps 61-75)
   */
  async setupEnhancedUX(agents: SpecializedAgentConfig[]): Promise<void> {
    console.log('✨ Phase 5: Enhanced User Experience (Steps 61-75)');
    
    // Steps 61-65: Split-screen interface setup
    await this.setupSplitScreenInterface(agents);
    
    // Steps 66-70: Real-time feedback and streaming
    await this.setupRealTimeStreaming(agents);
    
    // Steps 71-75: Professional UI/UX and session management
    await this.setupProfessionalUI(agents);
    await this.setupSessionPersistence(agents);
  }

  /**
   * Repository Analysis (Step 1-4)
   */
  private async analyzeRepository(workingDir: string): Promise<ProjectAnalysis['repository']> {
    const stats = await fs.stat(workingDir);
    const gitDir = path.join(workingDir, '.git');
    
    let gitInfo = {
      git_branch: 'main',
      remote_urls: [] as string[]
    };

    try {
      // Try to get git info
      const { execSync } = await import('child_process');
      gitInfo.git_branch = execSync('git branch --show-current', { cwd: workingDir }).toString().trim();
      const remotes = execSync('git remote -v', { cwd: workingDir }).toString().trim();
      gitInfo.remote_urls = remotes.split('\n').map(line => line.split('\t')[1]?.split(' ')[0]).filter(Boolean);
    } catch (error) {
      console.warn('Git info not available');
    }

    // Detect primary language
    const files = await fs.readdir(workingDir);
    let primaryLanguage = 'javascript';
    
    if (files.some(f => f.endsWith('.ts'))) primaryLanguage = 'typescript';
    else if (files.some(f => f.endsWith('.py'))) primaryLanguage = 'python';
    else if (files.some(f => f.endsWith('.go'))) primaryLanguage = 'go';
    else if (files.some(f => f.endsWith('.rs'))) primaryLanguage = 'rust';
    else if (files.some(f => f.endsWith('.java'))) primaryLanguage = 'java';

    return {
      name: path.basename(workingDir),
      path: workingDir,
      git_branch: gitInfo.git_branch,
      remote_urls: gitInfo.remote_urls,
      primary_language: primaryLanguage
    };
  }

  /**
   * Technology Detection (Steps 5-10)
   */
  private async detectTechnologies(workingDir: string): Promise<TechnologyProfile[]> {
    const technologies: TechnologyProfile[] = [];
    
    // Check package.json for Node.js technologies
    try {
      const packageJsonPath = path.join(workingDir, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      
      const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      // Framework detection
      if (allDeps.react) {
        technologies.push({
          name: 'React',
          version: allDeps.react,
          confidence: 0.95,
          category: 'framework',
          patterns: ['jsx', 'tsx', 'component'],
          expertise_level: 'expert'
        });
      }
      
      if (allDeps.next) {
        technologies.push({
          name: 'Next.js',
          version: allDeps.next,
          confidence: 0.95,
          category: 'framework',
          dependencies: ['react'],
          patterns: ['pages', 'app directory', 'api routes'],
          expertise_level: 'expert'
        });
      }
      
      if (allDeps.vue) {
        technologies.push({
          name: 'Vue.js',
          version: allDeps.vue,
          confidence: 0.95,
          category: 'framework',
          patterns: ['sfc', 'composition api'],
          expertise_level: 'expert'
        });
      }

      // Backend frameworks
      if (allDeps.express) {
        technologies.push({
          name: 'Express.js',
          version: allDeps.express,
          confidence: 0.90,
          category: 'framework',
          patterns: ['middleware', 'routes', 'rest api'],
          expertise_level: 'expert'
        });
      }

      // Database technologies
      if (allDeps.prisma) {
        technologies.push({
          name: 'Prisma',
          version: allDeps.prisma,
          confidence: 0.85,
          category: 'database',
          patterns: ['schema.prisma', 'migrations'],
          expertise_level: 'intermediate'
        });
      }

    } catch (error) {
      console.warn('package.json not found or invalid');
    }

    // Check for Python technologies
    try {
      const requirementsPath = path.join(workingDir, 'requirements.txt');
      const requirements = await fs.readFile(requirementsPath, 'utf-8');
      
      if (requirements.includes('django')) {
        technologies.push({
          name: 'Django',
          confidence: 0.90,
          category: 'framework',
          patterns: ['models.py', 'views.py', 'urls.py'],
          expertise_level: 'expert'
        });
      }
    } catch (error) {
      // requirements.txt not found
    }

    return technologies;
  }

  /**
   * Architecture Analysis (Steps 11-13)
   */
  private async analyzeArchitecture(workingDir: string): Promise<ProjectAnalysis['architecture']> {
    const files = await this.getAllFiles(workingDir);
    let complexityScore = 0;
    let architectureType: 'monolith' | 'microservices' | 'serverless' | 'hybrid' = 'monolith';
    const patterns: string[] = [];

    // Check for microservices indicators
    if (files.some(f => f.includes('docker-compose') || f.includes('kubernetes'))) {
      architectureType = 'microservices';
      patterns.push('containerized');
      complexityScore += 30;
    }

    // Check for serverless indicators
    if (files.some(f => f.includes('serverless.yml') || f.includes('sam.yaml'))) {
      architectureType = 'serverless';
      patterns.push('serverless');
      complexityScore += 20;
    }

    // Calculate complexity based on project structure
    const srcFiles = files.filter(f => f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.py'));
    complexityScore += Math.min(srcFiles.length * 2, 100);

    return {
      type: architectureType,
      patterns,
      complexity_score: Math.min(complexityScore, 100)
    };
  }

  /**
   * API Integration Detection (Step 14)
   */
  private async detectApiIntegrations(workingDir: string): Promise<ProjectAnalysis['api_integrations']> {
    const files = await this.getAllFiles(workingDir);
    const content = await this.getFileContents(files.slice(0, 50)); // Sample files

    return {
      figma: content.some(c => c.includes('figma') || c.includes('FIGMA_TOKEN')),
      github: content.some(c => c.includes('github.com') || c.includes('GITHUB_TOKEN')),
      oauth_providers: this.detectOAuthProviders(content),
      external_apis: this.detectExternalAPIs(content)
    };
  }

  /**
   * Workflow Analysis (Step 15)
   */
  private async analyzeWorkflow(workingDir: string): Promise<ProjectAnalysis['development_workflow']> {
    const files = await this.getAllFiles(workingDir);
    
    return {
      testing_framework: this.detectTestingFrameworks(files),
      ci_cd_tools: this.detectCICDTools(files),
      deployment_targets: this.detectDeploymentTargets(files),
      package_managers: this.detectPackageManagers(files)
    };
  }

  /**
   * Select candidate agents based on analysis (Steps 16-18)
   * 🔥 FIXED: Now works for ALL queries including greetings!
   */
  private async selectCandidateAgents(
    analysis: ProjectAnalysis, 
    userQuery: string
  ): Promise<AgentProfile[]> {
    const allAgents = this.agentRegistry.getAgents();
    const candidates: AgentProfile[] = [];
    const queryLower = userQuery.toLowerCase();

    console.log(`🔍 Candidate Selection: Found ${allAgents.length} total agents available`);
    
    // UNIVERSAL FALLBACK: Always ensure we have at least one agent for ANY query
    const getUniversalAgent = () => {
      // Priority order for universal queries
      const universalTypes: AgentType[] = ['researcher', 'task-dispatcher', 'architect', 'cli'];
      for (const type of universalTypes) {
        const agent = allAgents.find(a => a.type === type);
        if (agent) return agent;
      }
      // Absolute fallback - return any available agent
      return allAgents[0];
    };

    // QUERY TYPE DETECTION with better pattern matching
    if (queryLower.includes('help') || queryLower.includes('how') || queryLower.includes('what') || 
        queryLower.includes('explain') || queryLower.includes('show me') || queryLower.includes('hey') || 
        queryLower.includes('hello') || queryLower.includes('hi ') || queryLower.includes('there')) {
      // Conversational/Help queries - prioritize researcher and task-dispatcher
      const researcher = allAgents.find(a => a.type === 'researcher');
      const dispatcher = allAgents.find(a => a.type === 'task-dispatcher');
      if (researcher) candidates.push(researcher);
      if (dispatcher && !candidates.includes(dispatcher)) candidates.push(dispatcher);
    }

    // ARCHITECTURE & COMPLEX PROJECTS
    if (analysis.architecture.complexity_score > 30) { // Lowered threshold
      const architect = allAgents.find(a => a.type === 'architect');
      if (architect && !candidates.includes(architect)) candidates.push(architect);
    }

    // TECHNOLOGY-SPECIFIC AGENTS (More comprehensive matching)
    for (const tech of analysis.technologies) {
      if (tech.category === 'framework') {
        // Frontend frameworks
        if (tech.name.toLowerCase().includes('react') || tech.name.toLowerCase().includes('next') || 
            tech.name.toLowerCase().includes('vue') || tech.name.toLowerCase().includes('angular')) {
          const frontend = allAgents.find(a => a.type === 'frontend');
          if (frontend && !candidates.includes(frontend)) candidates.push(frontend);
        }
        
        // Backend frameworks
        if (tech.name.toLowerCase().includes('express') || tech.name.toLowerCase().includes('django') ||
            tech.name.toLowerCase().includes('flask') || tech.name.toLowerCase().includes('fastapi')) {
          const backend = allAgents.find(a => a.type === 'backend');
          if (backend && !candidates.includes(backend)) candidates.push(backend);
        }
      }
    }

    // TYPESCRIPT/JAVASCRIPT PROJECTS get CLI agent
    if (analysis.repository.primary_language === 'typescript' || 
        analysis.repository.primary_language === 'javascript') {
      const cliAgent = allAgents.find(a => a.type === 'cli' || a.type === 'code-cli-developer');
      if (cliAgent && !candidates.includes(cliAgent)) candidates.push(cliAgent);
    }

    // TESTING FRAMEWORKS
    if (analysis.development_workflow.testing_framework.length > 0) {
      const tester = allAgents.find(a => a.type === 'test-writer');
      if (tester && !candidates.includes(tester)) candidates.push(tester);
    }

    // QUERY-BASED INTELLIGENT MATCHING
    if (queryLower.includes('design') || queryLower.includes('ui') || queryLower.includes('figma') || queryLower.includes('styling')) {
      const designer = allAgents.find(a => a.type === 'design' || a.type === 'figma-extractor');
      if (designer && !candidates.includes(designer)) candidates.push(designer);
    }

    if (queryLower.includes('security') || queryLower.includes('auth') || queryLower.includes('login') || queryLower.includes('permission')) {
      const security = allAgents.find(a => a.type === 'security');
      if (security && !candidates.includes(security)) candidates.push(security);
    }

    if (queryLower.includes('deploy') || queryLower.includes('docker') || queryLower.includes('production') || queryLower.includes('ci')) {
      const devops = allAgents.find(a => a.type === 'devops' || a.type === 'production-architect');
      if (devops && !candidates.includes(devops)) candidates.push(devops);
    }

    if (queryLower.includes('test') || queryLower.includes('bug') || queryLower.includes('debug') || queryLower.includes('fix')) {
      const tester = allAgents.find(a => a.type === 'test-writer');
      if (tester && !candidates.includes(tester)) candidates.push(tester);
    }

    if (queryLower.includes('performance') || queryLower.includes('optimize') || queryLower.includes('slow') || queryLower.includes('speed')) {
      const performance = allAgents.find(a => a.type === 'performance');
      if (performance && !candidates.includes(performance)) candidates.push(performance);
    }

    // 🚨 CRITICAL: ENSURE WE ALWAYS HAVE AT LEAST ONE AGENT
    if (candidates.length === 0) {
      console.log('⚠️ No specific candidates found, adding universal agent...');
      const universalAgent = getUniversalAgent();
      if (universalAgent) {
        candidates.push(universalAgent);
        console.log(`✅ Added universal agent: ${universalAgent.name} (${universalAgent.type})`);
      }
    }

    // Add more agents if we have room and they're available
    if (candidates.length < 3) {
      const remaining = allAgents.filter(agent => !candidates.includes(agent));
      const additionalAgents = remaining.slice(0, 3 - candidates.length);
      candidates.push(...additionalAgents);
    }

    console.log(`🎯 Selected ${candidates.length} candidate agents:`);
    for (const candidate of candidates) {
      console.log(`   • ${candidate.name} (${candidate.type})`);
    }

    return candidates.slice(0, 8); // Limit to 8 agents
  }

  /**
   * Apply technology specialization (Steps 19-24)
   * 🔥 ENHANCED: More bonuses, universal agent support, better scoring
   */
  private async applyTechnologySpecialization(
    agent: AgentProfile, 
    analysis: ProjectAnalysis,
    userQuery: string
  ): Promise<SpecializedAgentConfig> {
    let confidenceScore = 0.4; // 🔥 RAISED BASE: 0.4 instead of 0.3
    const reasoning: string[] = [`Base ${agent.type} agent`];
    const technologyMatch: TechnologyProfile[] = [];
    const specializations: AgentSpecialization[] = [];
    const queryLower = userQuery.toLowerCase();

    console.log(`🔍 Scoring agent ${agent.name} (${agent.type})...`);

    // 🚀 UNIVERSAL AGENT BONUSES
    if (agent.type === 'researcher' || agent.type === 'task-dispatcher') {
      confidenceScore += 0.15; // Universal agents get bonus for any query
      reasoning.push('universal agent');
    }

    // 🗨️ CONVERSATIONAL QUERY BONUSES
    if (queryLower.includes('hey') || queryLower.includes('hello') || queryLower.includes('hi ') || 
        queryLower.includes('there') || queryLower.includes('help') || queryLower.includes('what')) {
      if (agent.type === 'researcher' || agent.type === 'task-dispatcher') {
        confidenceScore += 0.2;
        reasoning.push('conversational query match');
      }
    }

    // 🏢 PROJECT LANGUAGE BONUSES
    if (analysis.repository.primary_language === 'typescript' && 
        (agent.type === 'cli' || agent.type === 'frontend' || agent.type === 'backend')) {
      confidenceScore += 0.15;
      reasoning.push('TypeScript project');
    }

    // 🎯 ARCHITECTURE BONUSES (Lowered thresholds)
    if (agent.type === 'architect') {
      if (analysis.architecture.complexity_score > 50) {
        confidenceScore += 0.25; // 🔥 INCREASED from 0.2
        reasoning.push('complex architecture');
      } else if (analysis.architecture.complexity_score > 20) {
        confidenceScore += 0.15; // Bonus for moderate complexity
        reasoning.push('moderate architecture');
      }
    }

    // 📊 TESTING FRAMEWORK BONUSES
    if (agent.type === 'test-writer' && analysis.development_workflow.testing_framework.length > 0) {
      confidenceScore += 0.2;
      reasoning.push(`${analysis.development_workflow.testing_framework.join(', ')} testing`);
    }

    // 🔧 TECHNOLOGY MATCHING (Lowered threshold)
    for (const tech of analysis.technologies) {
      const match = this.matchAgentToTechnology(agent.type, tech);
      if (match.confidence > 0.5) { // 🔥 LOWERED from 0.7 to 0.5
        confidenceScore += match.confidence * 0.3; // Slightly reduced multiplier
        technologyMatch.push(tech);
        reasoning.push(`${tech.name} expertise`);
        
        // Create specialization
        specializations.push({
          technology: tech.name,
          version: tech.version,
          capabilities: [{
            name: `${tech.name} Development`,
            description: `Expert-level ${tech.name} development`,
            proficiency: tech.expertise_level
          }],
          prompts: {
            system: `You are an expert ${tech.name} developer. Focus on ${tech.name} best practices.`,
            context: `Use ${tech.name} patterns and conventions.`,
            examples: []
          },
          tools: this.getToolsForTechnology(tech.name)
        });
      }
    }

    // 🎯 QUERY KEYWORD BONUSES
    if (queryLower.includes('cli') && agent.type === 'cli') {
      confidenceScore += 0.2;
      reasoning.push('CLI query match');
    }
    
    if (queryLower.includes('security') && agent.type === 'security') {
      confidenceScore += 0.2;
      reasoning.push('security query match');
    }
    
    if (queryLower.includes('design') && agent.type === 'design') {
      confidenceScore += 0.2;
      reasoning.push('design query match');
    }

    const finalScore = Math.min(confidenceScore, 1.0);
    console.log(`   → Final score: ${finalScore.toFixed(2)} (${reasoning.join(', ')})`);

    return {
      base_agent: agent,
      specializations,
      confidence_score: finalScore,
      reasoning: reasoning.join(', '),
      technology_match: technologyMatch,
      enhanced_capabilities: [],
      custom_tools: [],
      specialized_prompts: {
        system: '',
        context: '',
        examples: []
      }
    };
  }

  // Helper methods for various detections and matching
  private async getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    const scan = async (currentDir: string, depth = 0): Promise<void> => {
      if (depth > 3) return; // Limit recursion depth
      
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          const relativePath = path.relative(dir, fullPath);
          
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await scan(fullPath, depth + 1);
          } else if (entry.isFile()) {
            files.push(relativePath);
          }
        }
      } catch (error) {
        // Skip inaccessible directories
      }
    };
    
    await scan(dir);
    return files;
  }

  private async getFileContents(files: string[]): Promise<string[]> {
    const contents: string[] = [];
    
    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        contents.push(content);
      } catch (error) {
        // Skip unreadable files
      }
    }
    
    return contents;
  }

  private detectOAuthProviders(contents: string[]): string[] {
    const providers: string[] = [];
    const content = contents.join(' ').toLowerCase();
    
    if (content.includes('google') && content.includes('oauth')) providers.push('Google');
    if (content.includes('github') && content.includes('oauth')) providers.push('GitHub');
    if (content.includes('auth0')) providers.push('Auth0');
    if (content.includes('okta')) providers.push('Okta');
    
    return providers;
  }

  private detectExternalAPIs(contents: string[]): string[] {
    const apis: string[] = [];
    const content = contents.join(' ').toLowerCase();
    
    if (content.includes('stripe')) apis.push('Stripe');
    if (content.includes('twilio')) apis.push('Twilio');
    if (content.includes('sendgrid')) apis.push('SendGrid');
    
    return apis;
  }

  private detectTestingFrameworks(files: string[]): string[] {
    const frameworks: string[] = [];
    
    if (files.some(f => f.includes('jest'))) frameworks.push('Jest');
    if (files.some(f => f.includes('cypress'))) frameworks.push('Cypress');
    if (files.some(f => f.includes('playwright'))) frameworks.push('Playwright');
    if (files.some(f => f.includes('vitest'))) frameworks.push('Vitest');
    
    return frameworks;
  }

  private detectCICDTools(files: string[]): string[] {
    const tools: string[] = [];
    
    if (files.some(f => f.includes('.github/workflows'))) tools.push('GitHub Actions');
    if (files.some(f => f.includes('gitlab-ci'))) tools.push('GitLab CI');
    if (files.some(f => f.includes('jenkins'))) tools.push('Jenkins');
    if (files.some(f => f.includes('circle'))) tools.push('CircleCI');
    
    return tools;
  }

  private detectDeploymentTargets(files: string[]): string[] {
    const targets: string[] = [];
    
    if (files.some(f => f.includes('vercel'))) targets.push('Vercel');
    if (files.some(f => f.includes('netlify'))) targets.push('Netlify');
    if (files.some(f => f.includes('docker'))) targets.push('Docker');
    if (files.some(f => f.includes('kubernetes'))) targets.push('Kubernetes');
    
    return targets;
  }

  private detectPackageManagers(files: string[]): string[] {
    const managers: string[] = [];
    
    if (files.some(f => f === 'package-lock.json')) managers.push('npm');
    if (files.some(f => f === 'yarn.lock')) managers.push('yarn');
    if (files.some(f => f === 'pnpm-lock.yaml')) managers.push('pnpm');
    if (files.some(f => f === 'requirements.txt')) managers.push('pip');
    if (files.some(f => f === 'Cargo.toml')) managers.push('cargo');
    
    return managers;
  }

  private matchAgentToTechnology(agentType: AgentType, tech: TechnologyProfile): { confidence: number } {
    const matches: Record<AgentType, string[]> = {
      'frontend': ['react', 'vue', 'angular', 'next', 'nuxt', 'gatsby'],
      'backend': ['express', 'fastify', 'nestjs', 'django', 'flask', 'fastapi', 'spring'],
      'architect': ['microservices', 'serverless', 'kubernetes', 'docker'],
      'test-writer': ['jest', 'cypress', 'playwright', 'pytest'],
      'design': ['figma', 'storybook'],
      'cli': ['commander', 'yargs', 'click'],
      'pr-merger': ['git', 'github'],
      'task-dispatcher': ['workflow'],
      'production-architect': ['docker', 'kubernetes', 'aws', 'gcp'],
      'code-cli-developer': ['cli', 'tooling'],
      'performance': ['optimization', 'benchmark', 'profiling', 'monitoring'],
      'security': ['auth', 'oauth', 'jwt', 'encryption', 'security'],
      'researcher': ['analysis', 'research', 'documentation', 'best-practices'],
      'figma-extractor': ['figma', 'design-tokens', 'assets'],
      'devops': ['docker', 'kubernetes', 'ci-cd', 'deployment', 'infrastructure']
    };

    const agentTechs = matches[agentType] || [];
    const techName = tech.name.toLowerCase();
    
    for (const agentTech of agentTechs) {
      if (techName.includes(agentTech)) {
        return { confidence: tech.confidence * (tech.expertise_level === 'expert' ? 1.0 : 0.8) };
      }
    }
    
    return { confidence: 0 };
  }

  private getToolsForTechnology(techName: string): string[] {
    const toolMap: Record<string, string[]> = {
      'react': ['jsx', 'hooks', 'state-management'],
      'nextjs': ['pages-router', 'app-router', 'api-routes'],
      'vue': ['composition-api', 'vue-router', 'pinia'],
      'express': ['middleware', 'routing', 'cors'],
      'django': ['orm', 'admin', 'rest-framework'],
      'prisma': ['schema', 'migrations', 'client']
    };
    
    return toolMap[techName.toLowerCase()] || [];
  }

  // Placeholder methods for remaining functionality
  private async loadTechnologySpecializations(): Promise<void> {
    // Load technology-specific specializations from files
  }

  private async enhanceAgentCapabilities(agent: SpecializedAgentConfig, analysis: ProjectAnalysis): Promise<void> {
    // Add enhanced capabilities based on project analysis
  }

  private async assignSpecializedTools(agent: SpecializedAgentConfig, analysis: ProjectAnalysis): Promise<void> {
    // STEP 26: MCP Server Discovery and Auto-Installation
    console.log(`🔌 Discovering MCP servers for ${agent.base_agent.name}...`);
    
    try {
      // Import MCP discovery module
      const { discoverMCPServersForProject } = await import('../mcp/server-discovery.js');
      
      // Discover MCP servers based on project analysis
      const mcpResult = await discoverMCPServersForProject(analysis, {
        autoInstall: true,
        skipValidation: false, // Validate servers can start
        silent: false,
        includeOptional: false
      });
      
      // Assign discovered MCP servers to agent
      if (Object.keys(mcpResult.recommendedServers).length > 0) {
        agent.mcp_servers = mcpResult.recommendedServers;
        agent.mcp_enabled_tools = [];
        
        // Collect all available MCP tools
        const { getMCPServerConfig } = await import('../mcp/server-registry.js');
        for (const serverName of Object.keys(mcpResult.recommendedServers)) {
          const config = getMCPServerConfig(serverName);
          if (config) {
            agent.mcp_enabled_tools.push(...config.tools.map(tool => `mcp__${serverName}__${tool}`));
          }
        }
        
        console.log(`✅ ${agent.base_agent.name} configured with ${Object.keys(mcpResult.recommendedServers).length} MCP servers`);
        console.log(`   Available tools: ${agent.mcp_enabled_tools.slice(0, 5).join(', ')}${agent.mcp_enabled_tools.length > 5 ? '...' : ''}`);
      } else {
        console.log(`⚠️ No MCP servers configured for ${agent.base_agent.name}`);
        
        // Fallback to minimal configuration
        const { createMinimalMCPConfiguration } = await import('../mcp/server-discovery.js');
        const minimalServers = createMinimalMCPConfiguration();
        
        if (Object.keys(minimalServers).length > 0) {
          agent.mcp_servers = minimalServers;
          agent.mcp_enabled_tools = ['mcp__filesystem__Read', 'mcp__filesystem__Write', 'mcp__git__Status'];
          console.log(`✅ ${agent.base_agent.name} configured with minimal MCP servers (filesystem, git)`);
        }
      }
      
      // Show any skipped servers with reasons
      if (mcpResult.skippedServers.length > 0) {
        console.log(`⚠️ Skipped MCP servers for ${agent.base_agent.name}:`);
        for (const skipped of mcpResult.skippedServers) {
          console.log(`   • ${skipped.name}: ${skipped.reason}`);
          if (skipped.missingEnv) {
            console.log(`     Missing env: ${skipped.missingEnv.join(', ')}`);
          }
        }
      }
      
    } catch (error) {
      console.error(`❌ MCP discovery failed for ${agent.base_agent.name}:`, error);
      
      // Always provide fallback - at minimum filesystem access
      agent.mcp_servers = {
        filesystem: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
          env: {}
        }
      };
      agent.mcp_enabled_tools = ['mcp__filesystem__Read', 'mcp__filesystem__Write'];
      
      console.log(`🔄 ${agent.base_agent.name} configured with emergency MCP fallback (filesystem only)`);
    }
  }

  private async generateSpecializedPrompts(agent: SpecializedAgentConfig, analysis: ProjectAnalysis, userQuery: string): Promise<void> {
    // Generate context-aware prompts
  }

  private async setupFigmaIntegration(agents: SpecializedAgentConfig[]): Promise<void> {
    // Setup Figma API integration
  }

  private async setupGitHubIntegration(agents: SpecializedAgentConfig[]): Promise<void> {
    // Setup GitHub API integration
  }

  private async setupOAuthProvider(agents: SpecializedAgentConfig[], provider: string): Promise<void> {
    // Setup OAuth provider
  }

  private async setupAgentCoordination(agents: SpecializedAgentConfig[], analysis: ProjectAnalysis): Promise<void> {
    // Setup multi-agent coordination
  }

  private async createTaskGraph(userQuery: string, agents: SpecializedAgentConfig[], analysis: ProjectAnalysis): Promise<any> {
    // Create task dependency graph
    return {};
  }

  private async executeTaskGraph(taskGraph: any, agents: SpecializedAgentConfig[]): Promise<void> {
    // Execute task graph with dependency resolution
  }

  private async monitorExecution(agents: SpecializedAgentConfig[], taskGraph: any): Promise<void> {
    // Monitor real-time execution
  }

  private async setupSplitScreenInterface(agents: SpecializedAgentConfig[]): Promise<void> {
    // Setup split-screen UI
  }

  private async setupRealTimeStreaming(agents: SpecializedAgentConfig[]): Promise<void> {
    // Setup real-time streaming
  }

  private async setupProfessionalUI(agents: SpecializedAgentConfig[]): Promise<void> {
    // Setup professional UI/UX
  }

  private async setupSessionPersistence(agents: SpecializedAgentConfig[]): Promise<void> {
    // Setup session persistence
  }
}

// Export singleton instance
export const specializationEngine = new SpecializationEngine();
