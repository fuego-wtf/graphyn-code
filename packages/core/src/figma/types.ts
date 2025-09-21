/**
 * Figma Integration Types
 *
 * Common type definitions for Figma design-to-code workflows
 */

export interface FigmaWorkflowConfig {
  userDataPath: string;
  outputPath: string;
  cssFramework: 'styled-components' | 'tailwind' | 'css-modules';
  generateStorybook: boolean;
  generateTests: boolean;
  languages: string[];
  includeI18n: boolean;
}

export interface FigmaWorkflowProgress {
  stage: 'auth' | 'extraction' | 'generation' | 'i18n' | 'integration' | 'complete';
  progress: number;
  message: string;
  componentsProcessed?: number;
  totalComponents?: number;
  errors?: string[];
}

export interface ExtractedComponent {
  id: string;
  name: string;
  type: string;
  props: Array<{
    name: string;
    type: string;
    default?: any;
  }>;
  styles: Record<string, any>;
  textContent: string[];
  children: ExtractedComponent[];
}

export interface FigmaWorkflowResult {
  success: boolean;
  components: ExtractedComponent[];
  generatedFiles: string[];
  i18nResult?: any;
  warnings: string[];
  errors: string[];
  metrics: {
    totalComponents: number;
    filesGenerated: number;
    i18nKeysExtracted: number;
    processingTimeMs: number;
  };
}