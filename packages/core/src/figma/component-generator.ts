/**
 * Figma-to-React Component Generator
 *
 * Converts extracted Figma design components into production-ready React components
 * with TypeScript, CSS-in-JS styling, and proper prop interfaces. Generates
 * maintainable, accessible, and responsive components.
 */

import { ExtractedComponent, ComponentProperty, ComponentStyle, ComponentLayout } from './prototype-extractor.js';

export interface GenerationConfig {
  typescript: boolean;
  cssFramework: 'styled-components' | 'emotion' | 'css-modules' | 'tailwind';
  includeStorybook: boolean;
  includeTests: boolean;
  accessibilityLevel: 'basic' | 'enhanced' | 'strict';
  responsiveBreakpoints: string[];
  iconLibrary?: 'react-icons' | 'heroicons' | 'lucide' | 'custom';
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'component' | 'styles' | 'types' | 'story' | 'test';
}

export interface ComponentGenerationResult {
  component: ExtractedComponent;
  files: GeneratedFile[];
  dependencies: string[];
  warnings: string[];
}

/**
 * Template engine for component generation
 */
class ComponentTemplate {
  private config: GenerationConfig;

  constructor(config: GenerationConfig) {
    this.config = config;
  }

  /**
   * Generate React component file content
   */
  generateComponent(component: ExtractedComponent): string {
    const imports = this.generateImports(component);
    const interfaces = this.generateInterfaces(component);
    const styledComponents = this.generateStyledComponents(component);
    const componentBody = this.generateComponentBody(component);

    return `${imports}

${interfaces}

${styledComponents}

${componentBody}`;
  }

  /**
   * Generate import statements
   */
  private generateImports(component: ExtractedComponent): string {
    const imports: string[] = [];

    // React imports
    if (this.config.typescript) {
      imports.push("import React from 'react';");
    } else {
      imports.push("import React from 'react';");
    }

    // Styling imports
    switch (this.config.cssFramework) {
      case 'styled-components':
        imports.push("import styled from 'styled-components';");
        break;
      case 'emotion':
        imports.push("import styled from '@emotion/styled';");
        break;
      case 'css-modules':
        imports.push(`import styles from './${component.name}.module.css';`);
        break;
    }

    // Child component imports
    for (const child of component.children) {
      if (child.type === 'COMPONENT') {
        imports.push(`import { ${child.name} } from './${child.name}';`);
      }
    }

    // Icon library imports
    if (this.config.iconLibrary && this.hasIcons(component)) {
      switch (this.config.iconLibrary) {
        case 'react-icons':
          imports.push("import { IconType } from 'react-icons';");
          break;
        case 'heroicons':
          imports.push("import { Icon } from '@heroicons/react/24/outline';");
          break;
        case 'lucide':
          imports.push("import { LucideIcon } from 'lucide-react';");
          break;
      }
    }

    return imports.join('\n');
  }

  /**
   * Generate TypeScript interfaces
   */
  private generateInterfaces(component: ExtractedComponent): string {
    if (!this.config.typescript) return '';

    const props: string[] = [];

    // Component-specific props
    for (const prop of component.props) {
      const optional = prop.defaultValue !== undefined ? '?' : '';
      const typeAnnotation = this.getTypeScriptType(prop);
      const comment = prop.description ? `  /** ${prop.description} */\n` : '';

      props.push(`${comment}  ${prop.name}${optional}: ${typeAnnotation};`);
    }

    // Common props
    props.push('  /** Additional CSS class name */');
    props.push('  className?: string;');
    props.push('  /** Custom styles */');
    props.push('  style?: React.CSSProperties;');

    // Accessibility props
    if (this.config.accessibilityLevel !== 'basic') {
      props.push('  /** Accessible label */');
      props.push('  "aria-label"?: string;');
      props.push('  /** Accessible description */');
      props.push('  "aria-describedby"?: string;');
    }

    return `export interface ${component.name}Props {
${props.join('\n')}
}`;
  }

  /**
   * Generate styled components
   */
  private generateStyledComponents(component: ExtractedComponent): string {
    if (this.config.cssFramework === 'css-modules' || this.config.cssFramework === 'tailwind') {
      return '';
    }

    const styles = this.generateComponentStyles(component);

    return `const ${component.name}Container = styled.div\`
${styles}
\`;`;
  }

  /**
   * Generate main component body
   */
  private generateComponentBody(component: ExtractedComponent): string {
    const propsInterface = this.config.typescript ? `${component.name}Props` : '';
    const propDestructuring = this.generatePropDestructuring(component);
    const children = this.generateChildren(component);
    const className = this.generateClassName(component);

    const componentName = component.name;
    const displayName = `'${componentName}'`;

    return `export const ${componentName}${this.config.typescript ? `: React.FC<${propsInterface}>` : ''} = (${propDestructuring}) => {
  return (
    <${this.getContainerElement(component)}${className}>
${children}
    </${this.getContainerElement(component)}>
  );
};

${componentName}.displayName = ${displayName};`;
  }

  /**
   * Generate prop destructuring
   */
  private generatePropDestructuring(component: ExtractedComponent): string {
    const props = component.props.map(prop => {
      if (prop.defaultValue !== undefined) {
        const defaultValue = this.formatDefaultValue(prop.defaultValue, prop.type);
        return `${prop.name} = ${defaultValue}`;
      }
      return prop.name;
    });

    props.push('className', 'style', '...rest');

    return `{ ${props.join(', ')} }`;
  }

  /**
   * Generate component children
   */
  private generateChildren(component: ExtractedComponent): string {
    const children: string[] = [];

    for (const child of component.children) {
      if (child.type === 'COMPONENT') {
        children.push(`      <${child.name} />`);
      } else if (child.textContent.length > 0) {
        // Text content
        const textProp = component.props.find(p => p.name === 'children' || p.name === 'text');
        if (textProp) {
          children.push(`      {${textProp.name}}`);
        } else {
          children.push(`      "${child.textContent[0]}"`);
        }
      }
    }

    // Default children prop if component has text
    if (children.length === 0 && component.textContent.length > 0) {
      const hasChildrenProp = component.props.some(p => p.name === 'children');
      if (hasChildrenProp) {
        children.push('      {children}');
      } else {
        children.push(`      "${component.textContent[0]}"`);
      }
    }

    return children.join('\n');
  }

  /**
   * Generate component styles
   */
  private generateComponentStyles(component: ExtractedComponent): string {
    const styles: string[] = [];

    // Layout styles
    const layout = component.layout;
    if (typeof layout.width === 'number') {
      styles.push(`  width: ${layout.width}px;`);
    } else if (layout.width === 'fill') {
      styles.push('  width: 100%;');
    }

    if (typeof layout.height === 'number') {
      styles.push(`  height: ${layout.height}px;`);
    } else if (layout.height === 'fill') {
      styles.push('  height: 100%;');
    }

    // Flexbox layout
    if (layout.direction) {
      styles.push('  display: flex;');
      styles.push(`  flex-direction: ${layout.direction};`);

      if (layout.align) {
        styles.push(`  align-items: ${layout.align};`);
      }

      if (layout.justify) {
        styles.push(`  justify-content: ${layout.justify};`);
      }

      if (layout.gap) {
        styles.push(`  gap: ${layout.gap}px;`);
      }
    }

    // Padding
    if (layout.padding) {
      const { top, right, bottom, left } = layout.padding;
      if (top === right && right === bottom && bottom === left) {
        styles.push(`  padding: ${top}px;`);
      } else {
        styles.push(`  padding: ${top}px ${right}px ${bottom}px ${left}px;`);
      }
    }

    // Visual styles
    const componentStyles = component.styles;

    if (componentStyles.backgroundColor) {
      styles.push(`  background-color: ${componentStyles.backgroundColor};`);
    }

    if (componentStyles.border) {
      const border = componentStyles.border;
      styles.push(`  border: ${border.width}px ${border.style} ${border.color};`);
      if (border.radius) {
        styles.push(`  border-radius: ${border.radius}px;`);
      }
    }

    if (componentStyles.shadow) {
      const shadow = componentStyles.shadow;
      styles.push(`  box-shadow: ${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.spread}px ${shadow.color};`);
    }

    if (componentStyles.typography) {
      const typo = componentStyles.typography;
      styles.push(`  font-family: ${typo.fontFamily};`);
      styles.push(`  font-size: ${typo.fontSize};`);
      styles.push(`  font-weight: ${typo.fontWeight};`);
      styles.push(`  line-height: ${typo.lineHeight};`);
      styles.push(`  color: ${typo.color};`);
    }

    // Responsive styles
    if (this.config.responsiveBreakpoints.length > 0) {
      styles.push('');
      styles.push('  /* Responsive styles */');
      for (const breakpoint of this.config.responsiveBreakpoints) {
        styles.push(`  @media (min-width: ${breakpoint}) {`);
        styles.push('    /* Add responsive styles here */');
        styles.push('  }');
      }
    }

    return styles.join('\n');
  }

  /**
   * Generate className logic
   */
  private generateClassName(component: ExtractedComponent): string {
    switch (this.config.cssFramework) {
      case 'css-modules':
        return ` className={cn(styles.container, className)}`;
      case 'tailwind':
        return ` className={cn("${this.generateTailwindClasses(component)}", className)}`;
      default:
        return ' className={className} style={style} {...rest}';
    }
  }

  /**
   * Generate Tailwind CSS classes
   */
  private generateTailwindClasses(component: ExtractedComponent): string {
    const classes: string[] = [];

    const layout = component.layout;

    // Layout classes
    if (layout.direction === 'row') {
      classes.push('flex flex-row');
    } else if (layout.direction === 'column') {
      classes.push('flex flex-col');
    }

    if (layout.align === 'center') {
      classes.push('items-center');
    } else if (layout.align === 'end') {
      classes.push('items-end');
    }

    if (layout.justify === 'center') {
      classes.push('justify-center');
    } else if (layout.justify === 'space-between') {
      classes.push('justify-between');
    }

    // Spacing
    if (layout.gap && layout.gap > 0) {
      const gapClass = this.pxToTailwindSpacing(layout.gap);
      classes.push(`gap-${gapClass}`);
    }

    // Add more Tailwind class mappings as needed

    return classes.join(' ');
  }

  /**
   * Get container element type
   */
  private getContainerElement(component: ExtractedComponent): string {
    if (this.config.cssFramework === 'styled-components' || this.config.cssFramework === 'emotion') {
      return `${component.name}Container`;
    }

    // Determine semantic HTML element
    const name = component.name.toLowerCase();
    if (name.includes('button')) {
      return 'button';
    } else if (name.includes('link')) {
      return 'a';
    } else if (name.includes('input') || name.includes('field')) {
      return 'input';
    } else if (name.includes('text') || name.includes('label')) {
      return 'span';
    }

    return 'div';
  }

  /**
   * Get TypeScript type for property
   */
  private getTypeScriptType(prop: ComponentProperty): string {
    switch (prop.type) {
      case 'boolean':
        return 'boolean';
      case 'string':
        return 'string';
      case 'variant':
        // For variant properties, create a union type
        return `'${prop.defaultValue}' | string`;
      case 'instance-swap':
        return 'React.ComponentType';
      default:
        return 'string';
    }
  }

  /**
   * Format default value for prop destructuring
   */
  private formatDefaultValue(value: any, type: string): string {
    if (type === 'string') {
      return `'${value}'`;
    } else if (type === 'boolean') {
      return value.toString();
    }
    return `'${value}'`;
  }

  /**
   * Check if component has icons
   */
  private hasIcons(component: ExtractedComponent): boolean {
    return component.children.some(child =>
      child.name.toLowerCase().includes('icon') ||
      child.figmaNode.type === 'VECTOR'
    );
  }

  /**
   * Convert pixel values to Tailwind spacing scale
   */
  private pxToTailwindSpacing(px: number): string {
    // Tailwind spacing scale: 1 = 0.25rem = 4px
    const spacing = Math.round(px / 4);
    return spacing.toString();
  }
}

/**
 * Main Component Generator class
 */
export class ComponentGenerator {
  private config: GenerationConfig;
  private template: ComponentTemplate;

  constructor(config: GenerationConfig) {
    this.config = config;
    this.template = new ComponentTemplate(config);
  }

  /**
   * Generate React components from extracted Figma components
   */
  async generateComponents(components: ExtractedComponent[]): Promise<ComponentGenerationResult[]> {
    const results: ComponentGenerationResult[] = [];

    for (const component of components) {
      const result = await this.generateComponent(component);
      results.push(result);
    }

    return results;
  }

  /**
   * Generate a single React component
   */
  async generateComponent(component: ExtractedComponent): Promise<ComponentGenerationResult> {
    const files: GeneratedFile[] = [];
    const dependencies: string[] = [];
    const warnings: string[] = [];

    // Generate main component file
    const componentContent = this.template.generateComponent(component);
    const componentExt = this.config.typescript ? '.tsx' : '.jsx';

    files.push({
      path: `${component.name}${componentExt}`,
      content: componentContent,
      type: 'component',
    });

    // Generate CSS modules file if needed
    if (this.config.cssFramework === 'css-modules') {
      const cssContent = this.generateCSSModules(component);
      files.push({
        path: `${component.name}.module.css`,
        content: cssContent,
        type: 'styles',
      });
    }

    // Generate TypeScript types file if needed
    if (this.config.typescript) {
      const typesContent = this.generateTypesFile(component);
      files.push({
        path: `${component.name}.types.ts`,
        content: typesContent,
        type: 'types',
      });
    }

    // Generate Storybook story if requested
    if (this.config.includeStorybook) {
      const storyContent = this.generateStorybook(component);
      files.push({
        path: `${component.name}.stories.${this.config.typescript ? 'tsx' : 'jsx'}`,
        content: storyContent,
        type: 'story',
      });
    }

    // Generate test file if requested
    if (this.config.includeTests) {
      const testContent = this.generateTests(component);
      files.push({
        path: `${component.name}.test.${this.config.typescript ? 'tsx' : 'jsx'}`,
        content: testContent,
        type: 'test',
      });
    }

    // Collect dependencies
    dependencies.push('react');

    switch (this.config.cssFramework) {
      case 'styled-components':
        dependencies.push('styled-components');
        break;
      case 'emotion':
        dependencies.push('@emotion/styled');
        break;
    }

    if (this.config.includeTests) {
      dependencies.push('@testing-library/react', '@testing-library/jest-dom');
    }

    // Generate warnings for potential issues
    if (component.textContent.length === 0 && component.children.length === 0) {
      warnings.push(`Component ${component.name} has no content. Consider adding children prop.`);
    }

    if (component.props.length === 0) {
      warnings.push(`Component ${component.name} has no props. Consider adding customization options.`);
    }

    return {
      component,
      files,
      dependencies,
      warnings,
    };
  }

  /**
   * Generate CSS modules content
   */
  private generateCSSModules(component: ExtractedComponent): string {
    // Convert styled-components CSS to CSS modules format
    const styles = this.template['generateComponentStyles'](component);

    return `.container {
${styles}
}`;
  }

  /**
   * Generate TypeScript types file
   */
  private generateTypesFile(component: ExtractedComponent): string {
    return `export interface ${component.name}Props {
  // Props interface is exported from main component file
}

export type ${component.name}Ref = HTMLDivElement;`;
  }

  /**
   * Generate Storybook story
   */
  private generateStorybook(component: ExtractedComponent): string {
    const imports = [
      "import type { Meta, StoryObj } from '@storybook/react';",
      `import { ${component.name} } from './${component.name}';`
    ].join('\n');

    const meta = `const meta: Meta<typeof ${component.name}> = {
  title: 'Components/${component.name}',
  component: ${component.name},
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;`;

    const stories = component.variants && component.variants.length > 0
      ? component.variants.map(variant => {
          const props = Object.entries(variant.properties)
            .map(([key, value]) => `    ${key}: '${value}',`)
            .join('\n');

          return `export const ${variant.name.replace(/[^a-zA-Z0-9]/g, '')}: Story = {
  args: {
${props}
  },
};`;
        }).join('\n\n')
      : `export const Default: Story = {
  args: {
    ${component.props.map(prop => `${prop.name}: ${JSON.stringify(prop.defaultValue)},`).join('\n    ')}
  },
};`;

    return `${imports}

${meta}

${stories}`;
  }

  /**
   * Generate test file
   */
  private generateTests(component: ExtractedComponent): string {
    return `import { render, screen } from '@testing-library/react';
import { ${component.name} } from './${component.name}';

describe('${component.name}', () => {
  it('renders without crashing', () => {
    render(<${component.name} />);
  });

  it('applies custom className', () => {
    const { container } = render(<${component.name} className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  ${component.props.filter(p => p.type === 'string').map(prop => `
  it('displays ${prop.name} prop', () => {
    render(<${component.name} ${prop.name}="test value" />);
    expect(screen.getByText('test value')).toBeInTheDocument();
  });`).join('')}
});`;
  }
}

/**
 * Factory function to create component generator with common configurations
 */
export function createComponentGenerator(framework: 'styled-components' | 'tailwind' | 'css-modules' = 'styled-components'): ComponentGenerator {
  const config: GenerationConfig = {
    typescript: true,
    cssFramework: framework,
    includeStorybook: true,
    includeTests: true,
    accessibilityLevel: 'enhanced',
    responsiveBreakpoints: ['768px', '1024px', '1280px'],
    iconLibrary: 'react-icons',
  };

  return new ComponentGenerator(config);
}