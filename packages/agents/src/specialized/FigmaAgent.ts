import { ClaudeCodeAgent } from '../base/ClaudeCodeAgent.js';
import type { Task } from '@graphyn/core';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

export interface FigmaToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope: string[];
}

export interface FigmaDesignFile {
  key: string;
  name: string;
  lastModified: string;
  thumbnailUrl?: string;
  version: string;
}

export interface ComponentSpec {
  id: string;
  name: string;
  description?: string;
  props: Record<string, any>;
  variants?: ComponentVariant[];
  assets: {
    images: string[];
    icons: string[];
    fonts: string[];
  };
}

export interface ComponentVariant {
  name: string;
  props: Record<string, any>;
  preview?: string;
}

export interface FigmaAgentConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  scopes?: string[];
  outputDirectory?: string;
  framework?: 'react' | 'vue' | 'angular' | 'svelte';
  styleFramework?: 'tailwind' | 'styled-components' | 'css-modules' | 'scss';
  includeTests?: boolean;
  includeStories?: boolean;
}

export class FigmaAgent extends ClaudeCodeAgent {
  private figmaConfig: FigmaAgentConfig;
  private token: FigmaToken | null = null;
  private readonly apiBase = 'https://api.figma.com/v1';
  private readonly oauthBase = 'https://www.figma.com/oauth';

  constructor(id: string, workingDirectory: string, config: FigmaAgentConfig = {}) {
    super({
      id,
      type: 'figma',
      specialization: 'Figma Integration with OAuth',
      capabilities: [
        'figma-api', 'design-tokens', 'component-extraction', 'storybook',
        'oauth-integration', 'component-generation', 'design-analysis'
      ],
      workspaceDir: workingDirectory,
      ...config
    });

    this.figmaConfig = {
      clientId: config.clientId || process.env.FIGMA_CLIENT_ID || '',
      clientSecret: config.clientSecret || process.env.FIGMA_CLIENT_SECRET || '',
      redirectUri: config.redirectUri || 'http://localhost:3000/auth/figma/callback',
      scopes: config.scopes || ['file_read'],
      outputDirectory: config.outputDirectory || './src/components/figma',
      framework: config.framework || 'react',
      styleFramework: config.styleFramework || 'tailwind',
      includeTests: config.includeTests ?? true,
      includeStories: config.includeStories ?? true
    };

    if (!this.figmaConfig.clientId || !this.figmaConfig.clientSecret) {
      this.emit('log', {
        level: 'warn',
        message: 'FigmaAgent: Missing OAuth credentials. Set FIGMA_CLIENT_ID and FIGMA_CLIENT_SECRET for full functionality.'
      });
    }
  }

  protected getSystemPrompt(): string {
    return `You are a Figma Integration Agent specialized in design systems, UI/UX workflows, and design-to-code implementation.

Core Responsibilities:
- Figma API integration and design token extraction
- Design system implementation and maintenance
- Component library generation from Figma designs
- Design-to-code automation and validation
- Brand consistency and style guide enforcement
- UI component documentation and Storybook integration
- Design review automation and feedback collection
- Asset optimization and export automation

Key Capabilities:
- Extract design tokens (colors, typography, spacing, shadows) from Figma
- Generate component code from Figma frames and components
- Implement responsive design patterns from Figma mockups
- Create design system documentation and component catalogs
- Automate asset exports (SVG, PNG, WebP) with proper optimization
- Validate design consistency across projects and teams
- Integrate design workflows with development processes
- Set up design system versioning and change management

Design System Expertise:
- Atomic design methodology (atoms, molecules, organisms)
- Design token management and CSS custom properties
- Component API design and prop interfaces
- Accessibility compliance (WCAG) in design implementation
- Responsive design patterns and breakpoint management
- Color theory, typography, and visual hierarchy principles
- Brand guidelines implementation and enforcement
- Cross-platform design system considerations

Technical Integration:
- Figma REST API and webhooks for real-time updates
- Design token formats (Style Dictionary, Theo, W3C)
- Component generation with React, Vue, Angular, or vanilla JS
- Storybook integration for component documentation
- Figma plugins development for custom workflows
- Version control integration for design assets
- CI/CD pipelines for design system updates
- Performance optimization for design assets

Workflow Automation:
- Automated design review and approval processes
- Design system change notifications and impact analysis
- Component usage tracking and deprecation management
- Design quality assurance and consistency validation
- Asset pipeline optimization and delivery
- Cross-team collaboration and handoff automation

Quality Standards:
- Maintain design fidelity in code implementation
- Ensure accessibility standards in all generated components
- Optimize performance of design assets and components
- Follow semantic naming conventions for design tokens
- Implement proper fallbacks and error handling
- Document component usage patterns and best practices

Always prioritize design consistency, accessibility, and maintainable design system architecture.`;
  }

  async initialize(): Promise<void> {
    await super.initialize();
    
    if (this.config.workspaceDir) {
      await this.detectDesignEnvironment();
    }
  }
  
  private async detectDesignEnvironment(): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    try {
      // Check for design system and Figma-related dependencies
      const packageJsonPath = path.join(this.config.workspaceDir!, 'package.json');
      const packageJsonExists = await fs.access(packageJsonPath).then(() => true).catch(() => false);
      
      if (packageJsonExists) {
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
        
        // Log design system tools detection
        const designTools = [];
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        if (dependencies['@figma/rest-api-spec']) designTools.push('Figma REST API');
        if (dependencies['figma-api']) designTools.push('Figma API Client');
        if (dependencies['style-dictionary']) designTools.push('Style Dictionary');
        if (dependencies['@storybook/react'] || dependencies['@storybook/vue']) designTools.push('Storybook');
        if (dependencies['styled-components'] || dependencies['@emotion/react']) designTools.push('CSS-in-JS');
        if (dependencies['@tailwindcss/forms'] || dependencies.tailwindcss) designTools.push('Tailwind CSS');
        if (dependencies['design-tokens']) designTools.push('Design Tokens');
        
        if (designTools.length > 0) {
          this.emit('log', { level: 'info', message: `Figma Agent detected design tools: ${designTools.join(', ')}` });
        }
      }

      // Check for design system configuration files
      const designFiles = [];
      const files: string[] = await fs.readdir(this.config.workspaceDir!).catch(() => []);
      
      if (files.includes('tokens.json') || files.includes('design-tokens.json')) {
        designFiles.push('Design tokens');
      }
      if (files.includes('style-dictionary.config.js') || files.includes('style-dictionary.config.json')) {
        designFiles.push('Style Dictionary config');
      }
      if (files.includes('.storybook')) designFiles.push('Storybook config');
      if (files.includes('figma.config.js') || files.includes('figma.config.json')) {
        designFiles.push('Figma config');
      }
      if (files.some((f: string) => f.startsWith('tailwind.config'))) designFiles.push('Tailwind config');
      
      if (designFiles.length > 0) {
        this.emit('log', { level: 'info', message: `Figma Agent detected design configs: ${designFiles.join(', ')}` });
      }

      // Check for design system directories
      const designDirs = [];
      const designPaths = [
        'design-system', 'components', 'ui', 'tokens', 'assets', 
        'stories', '.storybook', 'design-tokens'
      ];
      
      for (const designPath of designPaths) {
        const fullPath = path.join(this.config.workspaceDir!, designPath);
        const exists = await fs.access(fullPath).then(() => true).catch(() => false);
        if (exists) {
          const stat = await fs.stat(fullPath);
          if (stat.isDirectory()) {
            designDirs.push(designPath);
          }
        }
      }
      
      if (designDirs.length > 0) {
        this.emit('log', { level: 'info', message: `Figma Agent found design directories: ${designDirs.join(', ')}` });
      }
    } catch (error) {
      this.emit('log', { level: 'warn', message: `Failed to detect design environment: ${error}` });
    }
  }

  public async canHandle(task: Task): Promise<boolean> {
    // Check if task is Figma/design-related
    const figmaKeywords = [
      'figma', 'design', 'ui', 'ux', 'component', 'token', 'style', 'brand',
      'visual', 'layout', 'mockup', 'prototype', 'asset', 'icon', 'color',
      'typography', 'spacing', 'shadow', 'gradient', 'design-system',
      'storybook', 'style-dictionary', 'atomic', 'molecule', 'organism',
      'accessibility', 'a11y', 'responsive', 'mobile', 'desktop',
      'export', 'optimization', 'svg', 'png', 'webp'
    ];

    const taskDescription = task.description.toLowerCase();
    const hasKeyword = figmaKeywords.some(keyword => taskDescription.includes(keyword));

    // Check task type
    const figmaTypes = ['implementation', 'analysis', 'documentation'];
    const isFigmaType = figmaTypes.includes(task.type);

    // Check for design-related file patterns in deliverables
    const designPatterns = [
      'component', 'token', 'style', 'theme', 'design', 'figma',
      '.story.', 'stories/', 'components/', 'ui/', 'assets/',
      '.svg', '.png', '.webp', 'storybook'
    ];
    const hasDesignFiles = task.deliverables.some(deliverable => 
      designPatterns.some(pattern => deliverable.includes(pattern))
    );

    // Check required skills
    const designSkills = [
      'figma', 'design system', 'ui design', 'ux design', 'component design',
      'design tokens', 'style guide', 'brand guidelines', 'accessibility',
      'responsive design', 'visual design', 'interaction design'
    ];
    const hasDesignSkills = task.requiredSkills.some(skill => 
      designSkills.some(designSkill => skill.toLowerCase().includes(designSkill))
    );

    return hasKeyword || isFigmaType || hasDesignFiles || hasDesignSkills;
  }

  protected buildTaskPrompt(task: Task): string {
    const context = super.buildTaskPrompt(task);
    
    return `${context}

Figma Integration Context:
- Focus on design fidelity and consistent implementation
- Extract and implement design tokens (colors, typography, spacing)
- Ensure accessibility compliance (WCAG 2.1) in all implementations
- Follow atomic design principles for component organization
- Maintain responsive design patterns across breakpoints
- Optimize assets for performance (proper formats, compression)
- Document component APIs and usage patterns clearly
- Implement proper semantic markup and ARIA attributes

Design System Approach:
1. Analyze Figma files for design patterns and tokens
2. Extract design tokens using appropriate tools (Style Dictionary, etc.)
3. Generate component code that matches design specifications
4. Implement responsive behavior as defined in Figma
5. Create comprehensive documentation and examples
6. Set up automated design validation and consistency checks
7. Ensure proper version control and change management

Quality Checklist:
- Visual fidelity matches Figma designs exactly
- Components are accessible and semantic
- Design tokens are properly implemented and documented
- Responsive behavior works across all breakpoints
- Performance is optimized (bundle size, loading)
- Component APIs are intuitive and well-documented
- Code follows established patterns and conventions

Always maintain the highest standards for design consistency and user experience.`;
  }

  /**
   * Initiate OAuth flow for Figma authentication
   */
  async initiateOAuth(): Promise<{ authUrl: string; state: string }> {
    if (!this.figmaConfig.clientId) {
      throw new Error('Figma client ID not configured');
    }

    const state = crypto.randomBytes(32).toString('hex');
    const params = new URLSearchParams({
      client_id: this.figmaConfig.clientId,
      redirect_uri: this.figmaConfig.redirectUri!,
      scope: this.figmaConfig.scopes!.join(','),
      state,
      response_type: 'code'
    });

    const authUrl = `${this.oauthBase}?${params.toString()}`;
    
    this.emit('log', {
      level: 'info',
      message: `OAuth URL generated: ${authUrl}`
    });
    
    return { authUrl, state };
  }

  /**
   * Complete OAuth flow with authorization code
   */
  async completeOAuth(code: string, state: string): Promise<FigmaToken> {
    if (!this.figmaConfig.clientId || !this.figmaConfig.clientSecret) {
      throw new Error('Figma OAuth credentials not configured');
    }

    const response = await fetch(`${this.oauthBase}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.figmaConfig.clientId,
        client_secret: this.figmaConfig.clientSecret,
        redirect_uri: this.figmaConfig.redirectUri!,
        code,
        grant_type: 'authorization_code'
      })
    });

    if (!response.ok) {
      throw new Error(`OAuth failed: ${response.statusText}`);
    }

    const data = await response.json() as any;
    
    this.token = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      scope: data.scope?.split(',') || this.figmaConfig.scopes!
    };

    // Save token securely
    await this.saveToken();
    
    this.emit('log', {
      level: 'info',
      message: 'Successfully authenticated with Figma'
    });
    
    return this.token;
  }

  /**
   * Load saved token from secure storage
   */
  async loadToken(): Promise<FigmaToken | null> {
    try {
      const tokenPath = path.join(process.env.HOME || '', '.graphyn', 'figma-token.json');
      const tokenData = await fs.readFile(tokenPath, 'utf-8');
      const token = JSON.parse(tokenData) as FigmaToken;
      
      // Check if token is expired
      if (token.expiresAt && new Date() >= new Date(token.expiresAt)) {
        if (token.refreshToken) {
          return await this.refreshToken(token.refreshToken);
        } else {
          this.emit('log', {
            level: 'warn',
            message: 'Figma token expired and no refresh token available'
          });
          return null;
        }
      }
      
      this.token = token;
      return token;
    } catch {
      return null;
    }
  }

  /**
   * Save token to secure storage
   */
  private async saveToken(): Promise<void> {
    if (!this.token) return;

    const tokenPath = path.join(process.env.HOME || '', '.graphyn', 'figma-token.json');
    await fs.mkdir(path.dirname(tokenPath), { recursive: true });
    await fs.writeFile(tokenPath, JSON.stringify(this.token, null, 2), { mode: 0o600 });
  }

  /**
   * Refresh expired token
   */
  private async refreshToken(refreshToken: string): Promise<FigmaToken> {
    if (!this.figmaConfig.clientId || !this.figmaConfig.clientSecret) {
      throw new Error('Figma OAuth credentials not configured');
    }

    const response = await fetch(`${this.oauthBase}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.figmaConfig.clientId,
        client_secret: this.figmaConfig.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    const data = await response.json() as any;
    
    this.token = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      scope: data.scope?.split(',') || this.figmaConfig.scopes!
    };

    await this.saveToken();
    
    this.emit('log', {
      level: 'info',
      message: 'Successfully refreshed Figma token'
    });
    
    return this.token;
  }

  /**
   * Make authenticated API request to Figma
   */
  private async figmaRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.token) {
      const loadedToken = await this.loadToken();
      if (!loadedToken) {
        throw new Error('No Figma token available. Please authenticate first using initiateOAuth().');
      }
    }

    const response = await fetch(`${this.apiBase}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token!.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`Figma API error: ${response.status} ${response.statusText}`);
    }

    return await response.json() as T;
  }

  /**
   * Get Figma file information
   */
  async getFigmaFile(fileKey: string): Promise<any> {
    this.emit('log', {
      level: 'info',
      message: `Fetching Figma file: ${fileKey}`
    });
    
    return await this.figmaRequest(`/files/${fileKey}`);
  }

  /**
   * Get specific nodes from Figma file
   */
  async getFigmaNodes(fileKey: string, nodeIds: string[]): Promise<any> {
    const ids = nodeIds.join(',');
    return await this.figmaRequest(`/files/${fileKey}/nodes?ids=${ids}`);
  }

  /**
   * Export images from Figma
   */
  async exportFigmaImages(
    fileKey: string, 
    nodeIds: string[], 
    format: 'svg' | 'png' | 'jpg' = 'svg'
  ): Promise<{ [key: string]: string }> {
    const ids = nodeIds.join(',');
    const response = await this.figmaRequest(`/images/${fileKey}?ids=${ids}&format=${format}&scale=2`);
    return response.images;
  }

  /**
   * Analyze components in Figma file
   */
  async analyzeDesignComponents(fileKey: string): Promise<ComponentSpec[]> {
    this.emit('log', {
      level: 'info',
      message: `Analyzing components in Figma file: ${fileKey}`
    });

    const fileData = await this.getFigmaFile(fileKey);
    const components: ComponentSpec[] = [];
    
    // Find component sets and components
    const componentSets = fileData.componentSets || {};
    const regularComponents = fileData.components || {};

    // Process component sets (variants)
    for (const [id, componentSet] of Object.entries(componentSets) as any[]) {
      const spec: ComponentSpec = {
        id,
        name: this.sanitizeComponentName(componentSet.name),
        description: componentSet.description,
        props: this.extractComponentProps(componentSet),
        variants: [],
        assets: { images: [], icons: [], fonts: [] }
      };

      // Find variants
      for (const [variantId, variant] of Object.entries(regularComponents) as any[]) {
        if (variant.componentSetId === id) {
          spec.variants!.push({
            name: variant.name,
            props: this.extractComponentProps(variant),
            preview: variant.thumbnailUrl
          });
        }
      }

      components.push(spec);
    }

    // Process standalone components
    for (const [id, component] of Object.entries(regularComponents) as any[]) {
      if (!component.componentSetId) {
        components.push({
          id,
          name: this.sanitizeComponentName(component.name),
          description: component.description,
          props: this.extractComponentProps(component),
          assets: { images: [], icons: [], fonts: [] }
        });
      }
    }

    this.emit('log', {
      level: 'info',
      message: `Found ${components.length} components for analysis`
    });

    return components;
  }

  /**
   * Generate component code from Figma specifications
   */
  async generateComponentCode(spec: ComponentSpec): Promise<void> {
    const outputDir = path.join(
      this.config.workspaceDir!, 
      this.figmaConfig.outputDirectory!, 
      spec.name
    );

    this.emit('log', {
      level: 'info',
      message: `Generating ${this.figmaConfig.framework} component: ${spec.name}`
    });

    await fs.mkdir(outputDir, { recursive: true });

    // Generate component based on framework
    const componentCode = await this.generateFrameworkComponent(spec);
    const ext = this.getFileExtension();
    
    await fs.writeFile(
      path.join(outputDir, `index${ext}`), 
      componentCode
    );

    // Generate styles if needed
    if (this.figmaConfig.styleFramework !== 'styled-components') {
      const stylesCode = this.generateComponentStyles(spec);
      const styleExt = this.getStyleExtension();
      await fs.writeFile(
        path.join(outputDir, `styles${styleExt}`), 
        stylesCode
      );
    }

    // Generate types for TypeScript
    if (this.figmaConfig.framework === 'react') {
      const typesCode = this.generateComponentTypes(spec);
      await fs.writeFile(
        path.join(outputDir, 'types.ts'), 
        typesCode
      );
    }

    // Generate Storybook stories
    if (this.figmaConfig.includeStories) {
      const storiesCode = this.generateStorybookStories(spec);
      await fs.writeFile(
        path.join(outputDir, `${spec.name}.stories${ext}`), 
        storiesCode
      );
    }

    // Generate tests
    if (this.figmaConfig.includeTests) {
      const testsCode = this.generateComponentTests(spec);
      await fs.writeFile(
        path.join(outputDir, `${spec.name}.test${ext}`), 
        testsCode
      );
    }

    this.emit('log', {
      level: 'info',
      message: `Successfully generated component: ${spec.name}`
    });
  }

  // Utility methods for component generation
  private generateFrameworkComponent(spec: ComponentSpec): string {
    switch (this.figmaConfig.framework) {
      case 'react':
        return this.generateReactComponent(spec);
      case 'vue':
        return this.generateVueComponent(spec);
      default:
        return this.generateReactComponent(spec); // Default to React
    }
  }

  private generateReactComponent(spec: ComponentSpec): string {
    const imports = ['import React from \'react\';'];
    
    if (this.figmaConfig.styleFramework === 'styled-components') {
      imports.push('import styled from \'styled-components\';');
    } else if (this.figmaConfig.styleFramework === 'css-modules') {
      imports.push('import styles from \'./styles.module.css\';');
    }

    const propsInterface = `
interface ${spec.name}Props {
  ${Object.entries(spec.props).map(([key, value]) => 
    `${key}?: ${this.getTypeScriptType(value)};`
  ).join('\n  ')}
  className?: string;
  children?: React.ReactNode;
}`;

    const component = `
export const ${spec.name}: React.FC<${spec.name}Props> = ({
  ${Object.keys(spec.props).join(', ')},
  className,
  children,
  ...props
}) => {
  return (
    <div 
      className={\`${spec.name.toLowerCase()}\${className ? \` \${className}\` : ''}\`}
      {...props}
    >
      {children}
    </div>
  );
};

${spec.name}.displayName = '${spec.name}';
`;

    return [
      ...imports,
      '',
      propsInterface,
      '',
      component
    ].join('\n');
  }

  private generateVueComponent(spec: ComponentSpec): string {
    return `
<template>
  <div :class="componentClass">
    <slot />
  </div>
</template>

<script setup lang="ts">
interface Props {
  ${Object.entries(spec.props).map(([key, value]) => 
    `${key}?: ${this.getTypeScriptType(value)}`
  ).join('\n  ')}
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  ${Object.entries(spec.props).map(([key, value]) => 
    `${key}: ${JSON.stringify(value)}`
  ).join(',\n  ')}
})

const componentClass = computed(() => [
  '${spec.name.toLowerCase()}',
  props.class
])
</script>

<style scoped>
.${spec.name.toLowerCase()} {
  /* Component styles */
}
</style>
`;
  }

  private generateComponentStyles(spec: ComponentSpec): string {
    return `.${spec.name.toLowerCase()} {
  /* Generated from Figma component: ${spec.name} */
  /* TODO: Add actual styles extracted from Figma */
}`;
  }

  private generateComponentTypes(spec: ComponentSpec): string {
    return `export interface ${spec.name}Props {
  ${Object.entries(spec.props).map(([key, value]) => 
    `${key}?: ${this.getTypeScriptType(value)};`
  ).join('\n  ')}
  className?: string;
  children?: React.ReactNode;
}

${spec.variants ? `
export interface ${spec.name}Variant {
  ${Object.entries(spec.variants[0]?.props || {}).map(([key, value]) => 
    `${key}: ${this.getTypeScriptType(value)};`
  ).join('\n  ')}
}` : ''}
`;
  }

  private generateStorybookStories(spec: ComponentSpec): string {
    return `import type { Meta, StoryObj } from '@storybook/react';
import { ${spec.name} } from './index';

const meta: Meta<typeof ${spec.name}> = {
  title: 'Figma Components/${spec.name}',
  component: ${spec.name},
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    ${Object.entries(spec.props).map(([key, value]) => 
      `${key}: ${JSON.stringify(value)}`
    ).join(',\n    ')}
  },
};

${spec.variants?.map(variant => `
export const ${variant.name.replace(/\s+/g, '')}: Story = {
  args: {
    ${Object.entries(variant.props).map(([key, value]) => 
      `${key}: ${JSON.stringify(value)}`
    ).join(',\n    ')}
  },
};`).join('\n') || ''}
`;
  }

  private generateComponentTests(spec: ComponentSpec): string {
    return `import { render, screen } from '@testing-library/react';
import { ${spec.name} } from './index';

describe('${spec.name}', () => {
  it('renders without crashing', () => {
    render(<${spec.name} />);
    expect(screen.getByRole('generic')).toBeInTheDocument();
  });

  ${Object.keys(spec.props).map(prop => `
  it('accepts ${prop} prop', () => {
    const testValue = 'test-${prop}';
    render(<${spec.name} ${prop}={testValue} />);
    // Add specific assertions based on prop behavior
  });`).join('\n')}
});
`;
  }

  // Helper methods
  private sanitizeComponentName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  private extractComponentProps(component: any): Record<string, any> {
    const props: Record<string, any> = {};
    
    if (component.componentPropertyDefinitions) {
      for (const [key, def] of Object.entries(component.componentPropertyDefinitions) as any[]) {
        props[key] = def.defaultValue || this.getDefaultValueForType(def.type);
      }
    }

    return props;
  }

  private getDefaultValueForType(type: string): any {
    switch (type) {
      case 'BOOLEAN': return false;
      case 'TEXT': return '';
      case 'INSTANCE_SWAP': return null;
      case 'VARIANT': return '';
      default: return null;
    }
  }

  private getTypeScriptType(value: any): string {
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'string') return 'string';
    if (Array.isArray(value)) return 'any[]';
    return 'any';
  }

  private getFileExtension(): string {
    switch (this.figmaConfig.framework) {
      case 'react': return '.tsx';
      case 'vue': return '.vue';
      case 'angular': return '.ts';
      case 'svelte': return '.svelte';
      default: return '.tsx';
    }
  }

  private getStyleExtension(): string {
    switch (this.figmaConfig.styleFramework) {
      case 'css-modules': return '.module.css';
      case 'scss': return '.scss';
      default: return '.css';
    }
  }

  /**
   * Extract Figma file key from URL or description
   */
  private extractFileKey(text: string): string | null {
    const match = text.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  }

  /**
   * Enhanced task execution with Figma-specific workflows
   */
  async executeTask(task: Task): Promise<any> {
    const result = await super.executeTask(task);

    // Check if this is a Figma-specific task that needs API integration
    const fileKey = this.extractFileKey(task.description);
    if (fileKey && this.figmaConfig.clientId) {
      try {
        switch (task.type) {
          case 'analysis':
            await this.handleFigmaAnalysis(fileKey, task);
            break;
          case 'implementation':
            await this.handleFigmaImplementation(fileKey, task);
            break;
        }
      } catch (error) {
        this.emit('log', {
          level: 'warn',
          message: `Figma API task failed, falling back to standard execution: ${error}`
        });
      }
    }
    
    return result;
  }

  private async handleFigmaAnalysis(fileKey: string, task: Task): Promise<void> {
    this.emit('log', {
      level: 'info',
      message: `Analyzing Figma file: ${fileKey}`
    });

    const components = await this.analyzeDesignComponents(fileKey);
    
    // Save analysis report
    const analysisPath = path.join(
      this.config.workspaceDir!, 
      'figma-analysis.json'
    );
    
    const analysis = {
      fileKey,
      components,
      analyzedAt: new Date().toISOString(),
      task: {
        id: task.id,
        description: task.description
      }
    };

    await fs.writeFile(analysisPath, JSON.stringify(analysis, null, 2));
    
    this.emit('log', {
      level: 'info',
      message: `Analysis saved to: ${analysisPath}`
    });
  }

  private async handleFigmaImplementation(fileKey: string, task: Task): Promise<void> {
    this.emit('log', {
      level: 'info',
      message: `Implementing components from Figma file: ${fileKey}`
    });

    const components = await this.analyzeDesignComponents(fileKey);
    
    // Generate code for each component
    for (const component of components) {
      await this.generateComponentCode(component);
    }

    this.emit('log', {
      level: 'info',
      message: `Generated ${components.length} components from Figma`
    });
  }
}
