import { ClaudeCodeAgent } from '../base/ClaudeCodeAgent';
import type { Task } from '@graphyn/core';

export class FigmaAgent extends ClaudeCodeAgent {
  constructor(id: string, workingDirectory: string, config = {}) {
    super(id, workingDirectory, {
      ...config,
      agentType: 'figma'
    });
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

  protected async prepareWorkspace(): Promise<void> {
    await super.prepareWorkspace();
    
    // Check for design system and Figma-related dependencies
    const packageJsonPath = this.path.join(this.workingDirectory, 'package.json');
    if (await this.fs.pathExists(packageJsonPath)) {
      const packageJson = await this.fs.readJson(packageJsonPath);
      
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
        this.logger.info(`Figma Agent detected design tools: ${designTools.join(', ')}`);
      }
    }

    // Check for design system configuration files
    const designFiles = [];
    const files = await this.fs.readdir(this.workingDirectory).catch(() => []);
    
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
    if (files.some(f => f.startsWith('tailwind.config'))) designFiles.push('Tailwind config');
    
    if (designFiles.length > 0) {
      this.logger.info(`Figma Agent detected design configs: ${designFiles.join(', ')}`);
    }

    // Check for design system directories
    const designDirs = [];
    const designPaths = [
      'design-system', 'components', 'ui', 'tokens', 'assets', 
      'stories', '.storybook', 'design-tokens'
    ];
    
    for (const designPath of designPaths) {
      const fullPath = this.path.join(this.workingDirectory, designPath);
      if (await this.fs.pathExists(fullPath)) {
        const stat = await this.fs.stat(fullPath);
        if (stat.isDirectory()) {
          designDirs.push(designPath);
        }
      }
    }
    
    if (designDirs.length > 0) {
      this.logger.info(`Figma Agent found design directories: ${designDirs.join(', ')}`);
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

  protected getTaskSpecificContext(task: Task): string {
    const context = super.getTaskSpecificContext(task);
    
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
}