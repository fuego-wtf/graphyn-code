import { ClaudeCodeAgent } from '../base/ClaudeCodeAgent.js';
import type { Task } from '@graphyn/core';

export class FrontendAgent extends ClaudeCodeAgent {
  constructor(id: string, workingDirectory: string, config = {}) {
    super({
      id,
      type: 'frontend',
      specialization: 'Frontend Development',
      capabilities: ['react', 'vue', 'css', 'typescript', 'responsive-design'],
      workspaceDir: workingDirectory,
      ...config
    });
  }

  protected getSystemPrompt(): string {
    return `You are a Frontend Development Agent specialized in building user interfaces and client-side applications.

Core Responsibilities:
- React, Vue, Angular, and vanilla JavaScript development
- CSS, Sass, and modern styling frameworks (Tailwind, styled-components)
- Component architecture and design systems
- Responsive design and mobile-first development
- Frontend performance optimization
- Client-side state management (Redux, Vuex, Zustand)
- Modern build tools (Webpack, Vite, Rollup)
- Testing with Jest, Vitest, Cypress, or Playwright

Key Capabilities:
- Create reusable UI components with proper TypeScript typing
- Implement responsive layouts and accessibility best practices
- Integrate APIs and handle client-side data fetching
- Set up build pipelines and development environments
- Optimize bundle size and runtime performance
- Write comprehensive frontend tests (unit, integration, e2e)
- Debug browser compatibility and performance issues

Development Standards:
- Follow component-driven development practices
- Implement proper error boundaries and loading states
- Ensure semantic HTML and WCAG accessibility compliance
- Use modern CSS techniques (Grid, Flexbox, custom properties)
- Apply progressive enhancement principles
- Maintain consistent code style with Prettier/ESLint

Focus Areas:
- User experience (UX) optimization
- Progressive web app (PWA) features
- Modern JavaScript/TypeScript patterns
- Component testing and visual regression testing
- Cross-browser compatibility
- Performance monitoring and optimization

Always consider the user experience impact of your implementations and prioritize clean, maintainable, and performant code.`;
  }

  async initialize(): Promise<void> {
    await super.initialize();
    
    // Check for frontend-specific dependencies and tooling
    if (this.config.workspaceDir) {
      await this.detectFrontendEnvironment();
    }
  }
  
  private async detectFrontendEnvironment(): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    try {
      const packageJsonPath = path.join(this.config.workspaceDir!, 'package.json');
      const packageJsonExists = await fs.access(packageJsonPath).then(() => true).catch(() => false);
      
      if (packageJsonExists) {
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
        
        // Log frontend framework detection
        const frameworks = [];
        if (packageJson.dependencies?.react || packageJson.devDependencies?.react) {
          frameworks.push('React');
        }
        if (packageJson.dependencies?.vue || packageJson.devDependencies?.vue) {
          frameworks.push('Vue');
        }
        if (packageJson.dependencies?.['@angular/core'] || packageJson.devDependencies?.['@angular/core']) {
          frameworks.push('Angular');
        }
        
        if (frameworks.length > 0) {
          this.emit('log', { level: 'info', message: `Frontend Agent detected frameworks: ${frameworks.join(', ')}` });
        }
      }

      // Check for common frontend build tools
      const buildTools = [];
      const files: string[] = await fs.readdir(this.config.workspaceDir!).catch(() => []);
      
      if (files.includes('vite.config.js') || files.includes('vite.config.ts')) {
        buildTools.push('Vite');
      }
      if (files.includes('webpack.config.js') || files.includes('webpack.config.ts')) {
        buildTools.push('Webpack');
      }
      if (files.includes('rollup.config.js') || files.includes('rollup.config.mjs')) {
        buildTools.push('Rollup');
      }
      if (files.includes('next.config.js') || files.includes('next.config.mjs')) {
        buildTools.push('Next.js');
      }
      if (files.includes('nuxt.config.js') || files.includes('nuxt.config.ts')) {
        buildTools.push('Nuxt.js');
      }

      if (buildTools.length > 0) {
        this.emit('log', { level: 'info', message: `Frontend Agent detected build tools: ${buildTools.join(', ')}` });
      }
    } catch (error) {
      this.emit('log', { level: 'warn', message: `Failed to detect frontend environment: ${error}` });
    }
  }

  public async canHandle(task: Task): Promise<boolean> {
    // Check if task is frontend-related
    const frontendKeywords = [
      'component', 'ui', 'frontend', 'react', 'vue', 'angular', 'css', 'styling',
      'responsive', 'layout', 'design', 'client', 'browser', 'dom', 'interface',
      'tailwind', 'bootstrap', 'sass', 'scss', 'typescript', 'javascript',
      'webpack', 'vite', 'rollup', 'build', 'bundle', 'performance', 'accessibility'
    ];

    const taskDescription = task.description.toLowerCase();
    const hasKeyword = frontendKeywords.some(keyword => taskDescription.includes(keyword));

    // Also check task type
    const frontendTypes = ['frontend_development', 'implementation', 'testing'];
    const isCorrectType = frontendTypes.includes(task.type);

    // Check for frontend-specific file extensions in deliverables
    const frontendExtensions = ['.tsx', '.jsx', '.vue', '.css', '.scss', '.sass', '.html', '.js', '.ts'];
    const hasFrontendFiles = task.deliverables.some(deliverable => 
      frontendExtensions.some(ext => deliverable.includes(ext))
    );

    return hasKeyword || isCorrectType || hasFrontendFiles;
  }

  protected buildTaskPrompt(task: Task): string {
    const context = super.buildTaskPrompt(task);
    
    return `${context}

Frontend Development Context:
- Focus on user interface and user experience
- Ensure responsive design and cross-browser compatibility
- Implement proper accessibility (WCAG) standards
- Consider performance implications (bundle size, runtime)
- Use semantic HTML and modern CSS techniques
- Follow component-driven development practices
- Write comprehensive tests for UI components
- Consider mobile-first approach for responsive design

Always prioritize clean, maintainable code that follows modern frontend best practices.`;
  }
}