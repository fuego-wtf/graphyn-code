/**
 * REV-071 & REV-002: Continuous Input Panel - Bottom Panel (10% of screen)
 * 
 * Provides persistent input area that remains always accessible and pinned to bottom,
 * with repository context awareness and dynamic agent prompt generation.
 */

import { EventEmitter } from 'events';
import { ANSIController } from './ANSIController.js';
import { PanelConfiguration } from './TerminalLayoutManager.js';
import { EnhancedInputHandler, InputContext } from '../console/EnhancedInputHandler.js';
import { BufferState } from '../console/InputBufferManager.js';

export interface RepositoryContext {
  workingDirectory: string;
  projectType?: 'node' | 'python' | 'go' | 'rust' | 'unknown';
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'pip' | 'cargo' | 'go mod';
  framework?: string[];
  mainLanguages: string[];
  hasDocumentation: boolean;
  hasTests: boolean;
  buildSystem?: string;
  lastUpdated: Date;
  contextPrompt: string; // Generated context-aware prompt for agents
}

export interface InputPromptConfig {
  placeholder: string;
  contextHints: string[];
  availableCommands: string[];
  agentSuggestions: string[];
}

export class ContinuousInputPanel extends EventEmitter {
  private panelConfig: PanelConfiguration;
  private inputHandler: EnhancedInputHandler;
  private repositoryContext?: RepositoryContext;
  private promptConfig: InputPromptConfig = {
    placeholder: 'graphyn>',
    contextHints: [],
    availableCommands: [],
    agentSuggestions: []
  };
  
  // Display state
  private isVisible: boolean = true;
  private showContextHints: boolean = true;
  private lastContextUpdate: Date = new Date();
  private contextUpdateTimer?: NodeJS.Timeout;

  constructor(panelConfig: PanelConfiguration, inputHandler: EnhancedInputHandler) {
    super();
    this.panelConfig = panelConfig;
    this.inputHandler = inputHandler;
    
    this.setupInputHandlers();
    this.startContextMonitoring();
  }

  /**
   * Update panel configuration (e.g., after terminal resize)
   */
  updatePanelConfig(config: PanelConfiguration): void {
    this.panelConfig = config;
    this.render();
  }

  /**
   * Update repository context and regenerate agent prompts
   */
  updateRepositoryContext(context: RepositoryContext): void {
    const oldDirectory = this.repositoryContext?.workingDirectory;
    this.repositoryContext = context;
    this.lastContextUpdate = new Date();
    
    // Update prompt configuration based on context
    this.updatePromptConfiguration();
    
    // Update input handler completion suggestions
    this.updateCompletionSuggestions();
    
    this.render();
    this.emit('repositoryContextUpdated', {
      oldDirectory,
      newDirectory: context.workingDirectory,
      context
    });
  }

  /**
   * Set input context for context-aware behavior
   */
  setInputContext(context: InputContext): void {
    this.inputHandler.setContext(context);
    this.updatePromptConfiguration();
    this.render();
  }

  /**
   * Show/hide context hints
   */
  setContextHintsVisible(visible: boolean): void {
    this.showContextHints = visible;
    this.render();
  }

  /**
   * Set panel visibility
   */
  setVisible(visible: boolean): void {
    this.isVisible = visible;
    if (visible) {
      this.render();
    } else {
      this.clearPanelArea();
    }
  }

  /**
   * Force refresh of repository context
   */
  async refreshRepositoryContext(): Promise<void> {
    const workingDir = process.cwd();
    const context = await this.analyzeRepository(workingDir);
    this.updateRepositoryContext(context);
  }

  /**
   * Setup input event handlers
   */
  private setupInputHandlers(): void {
    this.inputHandler.on('bufferChanged', (state: BufferState) => {
      this.renderInputLine();
    });

    this.inputHandler.on('cursorMoved', () => {
      this.renderInputLine();
    });

    this.inputHandler.on('inputSubmitted', (event) => {
      this.emit('inputSubmitted', event);
    });

    this.inputHandler.on('contextChanged', () => {
      this.updatePromptConfiguration();
      this.render();
    });

    // Handle context-specific navigation
    this.inputHandler.on('navigationRequest', (event) => {
      this.emit('navigationRequest', event);
    });

    // Handle approval workflow events
    this.inputHandler.on('taskApprovalToggle', () => {
      this.emit('taskApprovalToggle');
    });

    this.inputHandler.on('approveAllTasks', () => {
      this.emit('approveAllTasks');
    });

    this.inputHandler.on('modifyExecutionPlan', () => {
      this.emit('modifyExecutionPlan');
    });

    this.inputHandler.on('provideFeedback', () => {
      this.emit('provideFeedback');
    });

    this.inputHandler.on('cancelExecution', () => {
      this.emit('cancelExecution');
    });
  }

  /**
   * Start monitoring for context changes
   */
  private startContextMonitoring(): void {
    // Monitor working directory changes
    this.contextUpdateTimer = setInterval(async () => {
      const currentDir = process.cwd();
      if (currentDir !== this.repositoryContext?.workingDirectory) {
        await this.refreshRepositoryContext();
      }
    }, 3000); // Check every 3 seconds as per spec FR-005
  }

  /**
   * Stop context monitoring
   */
  private stopContextMonitoring(): void {
    if (this.contextUpdateTimer) {
      clearInterval(this.contextUpdateTimer);
      this.contextUpdateTimer = undefined;
    }
  }

  /**
   * Update prompt configuration based on current context
   */
  private updatePromptConfiguration(): void {
    const context = this.inputHandler.getContext();
    
    // Base configuration
    this.promptConfig = {
      placeholder: this.generateContextAwarePlaceholder(),
      contextHints: this.generateContextHints(),
      availableCommands: this.generateAvailableCommands(context),
      agentSuggestions: this.generateAgentSuggestions()
    };
  }

  /**
   * Generate context-aware placeholder text
   */
  private generateContextAwarePlaceholder(): string {
    const basePrompt = 'graphyn>';
    
    if (!this.repositoryContext) {
      return basePrompt;
    }
    
    const context = this.inputHandler.getContext();
    const repoType = this.repositoryContext.projectType;
    const framework = this.repositoryContext.framework?.[0];
    
    switch (context) {
      case InputContext.APPROVAL:
        return 'approval>';
      case InputContext.EXECUTION:
        return 'executing>';
      default:
        if (repoType && framework) {
          return `graphyn:${repoType}:${framework}>`;
        } else if (repoType) {
          return `graphyn:${repoType}>`;
        }
        return basePrompt;
    }
  }

  /**
   * Generate context hints based on repository analysis
   */
  private generateContextHints(): string[] {
    if (!this.repositoryContext) {
      return ['Analyze repository context...'];
    }
    
    const hints: string[] = [];
    
    // Add project type hint
    if (this.repositoryContext.projectType !== 'unknown') {
      hints.push(`${this.repositoryContext.projectType?.toUpperCase()} project`);
    }
    
    // Add framework hints
    if (this.repositoryContext.framework?.length) {
      hints.push(`${this.repositoryContext.framework.join(', ')}`);
    }
    
    // Add capability hints
    if (this.repositoryContext.hasTests) {
      hints.push('Tests available');
    }
    
    if (this.repositoryContext.hasDocumentation) {
      hints.push('Docs available');
    }
    
    return hints;
  }

  /**
   * Generate available commands based on context
   */
  private generateAvailableCommands(context: InputContext): string[] {
    const baseCommands = [
      'help', 'analyze', 'build', 'test', 'deploy', 
      'review', 'optimize', 'document', 'refactor'
    ];
    
    if (!this.repositoryContext) {
      return baseCommands;
    }
    
    const contextCommands: string[] = [...baseCommands];
    
    // Add project-specific commands
    switch (this.repositoryContext.projectType) {
      case 'node':
        contextCommands.push('npm install', 'npm start', 'npm test');
        break;
      case 'python':
        contextCommands.push('pip install', 'pytest', 'python -m');
        break;
      case 'go':
        contextCommands.push('go mod tidy', 'go run', 'go test');
        break;
      case 'rust':
        contextCommands.push('cargo build', 'cargo test', 'cargo run');
        break;
    }
    
    // Add context-specific commands
    switch (context) {
      case InputContext.APPROVAL:
        return ['approve', 'modify', 'feedback', 'cancel'];
      case InputContext.EXECUTION:
        return ['stop', 'pause', 'status', 'logs'];
    }
    
    return contextCommands;
  }

  /**
   * Generate agent suggestions based on repository
   */
  private generateAgentSuggestions(): string[] {
    if (!this.repositoryContext) {
      return ['@architect', '@backend', '@frontend'];
    }
    
    const suggestions = ['@architect'];
    
    // Add project-specific agents
    const languages = this.repositoryContext.mainLanguages;
    const frameworks = this.repositoryContext.framework || [];
    
    if (languages.includes('typescript') || languages.includes('javascript')) {
      if (frameworks.some(f => ['react', 'vue', 'angular', 'svelte'].includes(f.toLowerCase()))) {
        suggestions.push('@frontend');
      }
      if (frameworks.some(f => ['express', 'fastify', 'nest'].includes(f.toLowerCase()))) {
        suggestions.push('@backend');
      }
      suggestions.push('@javascript');
    }
    
    if (languages.includes('python')) {
      suggestions.push('@backend', '@ai', '@data');
    }
    
    if (languages.includes('rust') || languages.includes('go')) {
      suggestions.push('@systems', '@backend');
    }
    
    // Add utility agents
    if (this.repositoryContext.hasTests) {
      suggestions.push('@tester');
    }
    
    if (this.repositoryContext.hasDocumentation) {
      suggestions.push('@docs');
    }
    
    return [...new Set(suggestions)]; // Remove duplicates
  }

  /**
   * Update completion suggestions in input handler
   */
  private updateCompletionSuggestions(): void {
    const allSuggestions = [
      ...this.promptConfig.availableCommands,
      ...this.promptConfig.agentSuggestions
    ];
    
    this.inputHandler.setCompletionSuggestions(allSuggestions);
  }

  /**
   * Main render method
   */
  render(): void {
    if (!this.isVisible) {
      return;
    }
    
    let output = '';
    
    // Clear the panel area
    output += this.clearPanelArea();
    
    // Render border
    output += this.renderBorder();
    
    // Render context hints if enabled
    if (this.showContextHints && this.panelConfig.height > 2) {
      output += this.renderContextHints();
    }
    
    // Render input line
    output += this.renderInputLine();
    
    // Write to stdout
    process.stdout.write(output);
  }

  /**
   * Clear the panel area
   */
  private clearPanelArea(): string {
    return ANSIController.clearRegion(
      this.panelConfig.startRow,
      this.panelConfig.endRow,
      this.panelConfig.startCol,
      this.panelConfig.endCol
    );
  }

  /**
   * Render panel border with context indicator
   */
  private renderBorder(): string {
    const title = this.generateBorderTitle();
    return ANSIController.createBox(
      this.panelConfig.startRow,
      this.panelConfig.startCol || 1,
      this.panelConfig.width,
      this.panelConfig.height,
      'single',
      title
    );
  }

  /**
   * Generate border title with context information
   */
  private generateBorderTitle(): string {
    const context = this.inputHandler.getContext();
    const baseTitle = '💻 Continuous Input';
    
    if (!this.repositoryContext) {
      return baseTitle;
    }
    
    const contextIndicator = this.getContextIndicator();
    const repoInfo = this.repositoryContext.projectType 
      ? ` (${this.repositoryContext.projectType.toUpperCase()})`
      : '';
    
    return `${contextIndicator} ${baseTitle}${repoInfo}`;
  }

  /**
   * Get context indicator emoji
   */
  private getContextIndicator(): string {
    const context = this.inputHandler.getContext();
    
    switch (context) {
      case InputContext.APPROVAL:
        return '✅';
      case InputContext.EXECUTION:
        return '⚡';
      case InputContext.EXIT_CONFIRMATION:
        return '🚪';
      case InputContext.HELP:
        return '❓';
      default:
        return '💻';
    }
  }

  /**
   * Render context hints
   */
  private renderContextHints(): string {
    let output = '';
    const hintsRow = this.panelConfig.startRow + 1;
    const contentWidth = this.panelConfig.width - 4; // Account for borders
    
    if (this.promptConfig.contextHints.length > 0) {
      output += ANSIController.moveCursor(hintsRow, this.panelConfig.startCol! + 2);
      
      const hints = this.promptConfig.contextHints.slice(0, 3).join(' • '); // Show max 3 hints
      const hintText = ANSIController.color(`💡 ${hints}`, { foreground: 'gray' });
      output += ANSIController.positionText(hintText, contentWidth, 'left');
    }
    
    return output;
  }

  /**
   * Render the input line with cursor
   */
  private renderInputLine(): string {
    const inputRow = this.panelConfig.endRow - 1; // Bottom of panel, above border
    const contentWidth = this.panelConfig.width - 4; // Account for borders
    const startCol = this.panelConfig.startCol! + 2;
    
    // Get current input state
    const bufferState = this.inputHandler.getBufferState();
    const placeholder = this.promptConfig.placeholder;
    const currentInput = bufferState.buffer;
    const cursorPos = bufferState.cursorPosition;
    
    // Clear the input line
    let output = ANSIController.moveCursor(inputRow, startCol);
    output += ANSIController.clearToEndOfLine();
    
    // Format: "placeholder input_text"
    const promptText = ANSIController.color(placeholder + ' ', { foreground: 'cyan', style: 'bold' });
    const displayText = currentInput || '';
    
    // Calculate available space for input
    const promptLength = ANSIController.stripAnsi(placeholder + ' ').length;
    const availableWidth = contentWidth - promptLength;
    
    // Handle text that's longer than available space
    let displayInput = displayText;
    let displayCursor = cursorPos;
    
    if (displayText.length > availableWidth) {
      // Scroll the input text to keep cursor visible
      const scrollOffset = Math.max(0, cursorPos - availableWidth + 10);
      displayInput = displayText.substring(scrollOffset);
      displayCursor = cursorPos - scrollOffset;
    }
    
    // Truncate if still too long
    if (displayInput.length > availableWidth) {
      displayInput = displayInput.substring(0, availableWidth - 1) + '…';
    }
    
    // Position cursor
    output += promptText + displayInput;
    
    // Show cursor
    const actualCursorPos = startCol + promptLength + displayCursor;
    output += ANSIController.moveCursor(inputRow, actualCursorPos);
    
    return output;
  }

  /**
   * Analyze repository to build context
   */
  private async analyzeRepository(workingDirectory: string): Promise<RepositoryContext> {
    // This is a simplified analysis - in real implementation, 
    // this would use file system scanning and package file parsing
    
    const context: RepositoryContext = {
      workingDirectory,
      projectType: 'unknown',
      mainLanguages: [],
      hasDocumentation: false,
      hasTests: false,
      lastUpdated: new Date(),
      contextPrompt: ''
    };
    
    try {
      // Simulate repository analysis
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // Check for package.json (Node.js project)
      try {
        const packageJsonPath = path.join(workingDirectory, 'package.json');
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
        
        context.projectType = 'node';
        context.packageManager = await this.detectPackageManager(workingDirectory);
        context.mainLanguages = ['javascript'];
        
        // Check for TypeScript
        if (packageJson.devDependencies?.typescript || packageJson.dependencies?.typescript) {
          context.mainLanguages.push('typescript');
        }
        
        // Detect frameworks
        context.framework = this.detectFrameworks(packageJson);
        
        // Check for tests
        context.hasTests = !!(packageJson.scripts?.test || packageJson.devDependencies?.jest || packageJson.devDependencies?.vitest);
        
      } catch {
        // Not a Node.js project, check other types
      }
      
      // Check for README
      const readmeFiles = ['README.md', 'README.txt', 'README.rst', 'readme.md'];
      for (const readme of readmeFiles) {
        try {
          await fs.access(path.join(workingDirectory, readme));
          context.hasDocumentation = true;
          break;
        } catch {
          // File doesn't exist
        }
      }
      
      // Generate context-aware prompt
      context.contextPrompt = this.generateContextPrompt(context);
      
    } catch (error) {
      console.error('Repository analysis failed:', error);
    }
    
    return context;
  }

  /**
   * Detect package manager
   */
  private async detectPackageManager(workingDir: string): Promise<string> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    try {
      await fs.access(path.join(workingDir, 'pnpm-lock.yaml'));
      return 'pnpm';
    } catch {}
    
    try {
      await fs.access(path.join(workingDir, 'yarn.lock'));
      return 'yarn';
    } catch {}
    
    return 'npm';
  }

  /**
   * Detect frameworks from package.json
   */
  private detectFrameworks(packageJson: any): string[] {
    const frameworks: string[] = [];
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    if (deps.react) frameworks.push('React');
    if (deps.vue) frameworks.push('Vue');
    if (deps.angular || deps['@angular/core']) frameworks.push('Angular');
    if (deps.svelte) frameworks.push('Svelte');
    if (deps.express) frameworks.push('Express');
    if (deps.fastify) frameworks.push('Fastify');
    if (deps['@nestjs/core']) frameworks.push('NestJS');
    if (deps.next) frameworks.push('Next.js');
    if (deps.nuxt) frameworks.push('Nuxt.js');
    
    return frameworks;
  }

  /**
   * Generate context-aware prompt for agents
   */
  private generateContextPrompt(context: RepositoryContext): string {
    let prompt = `You are working in a ${context.projectType} project`;
    
    if (context.framework?.length) {
      prompt += ` using ${context.framework.join(', ')}`;
    }
    
    if (context.packageManager) {
      prompt += ` with ${context.packageManager} package management`;
    }
    
    prompt += `. Main languages: ${context.mainLanguages.join(', ')}.`;
    
    if (context.hasTests) {
      prompt += ' The project has test coverage.';
    }
    
    if (context.hasDocumentation) {
      prompt += ' Documentation is available.';
    }
    
    prompt += ' Provide context-aware suggestions and use appropriate tools for this project setup.';
    
    return prompt;
  }

  /**
   * Get current repository context
   */
  getRepositoryContext(): RepositoryContext | undefined {
    return this.repositoryContext;
  }

  /**
   * Get current input state
   */
  getInputState() {
    return {
      bufferState: this.inputHandler.getBufferState(),
      context: this.inputHandler.getContext(),
      repositoryContext: this.repositoryContext,
      promptConfig: this.promptConfig,
      isVisible: this.isVisible
    };
  }

  /**
   * Clean shutdown
   */
  cleanup(): void {
    this.stopContextMonitoring();
    this.inputHandler.cleanup();
    this.removeAllListeners();
  }
}