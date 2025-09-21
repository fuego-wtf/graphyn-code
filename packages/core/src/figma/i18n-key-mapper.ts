/**
 * Figma i18n Key Mapper
 *
 * Extracts text content from Figma components and generates
 * internationalization (i18n) keys for translation management.
 * Creates structured translation files and provides key mapping
 * for React components.
 */

import { ExtractedComponent } from './prototype-extractor.js';

export interface I18nKey {
  key: string;
  value: string;
  description?: string;
  context: string;
  componentName: string;
  category: 'button' | 'label' | 'title' | 'description' | 'error' | 'placeholder' | 'tooltip' | 'general';
}

export interface I18nFile {
  language: string;
  translations: Record<string, string>;
  metadata: {
    generatedAt: string;
    source: 'figma';
    totalKeys: number;
    components: string[];
  };
}

export interface I18nMapping {
  componentName: string;
  textMappings: Array<{
    originalText: string;
    i18nKey: string;
    propName: string;
  }>;
}

export interface I18nExtractionResult {
  keys: I18nKey[];
  files: I18nFile[];
  mappings: I18nMapping[];
  warnings: string[];
}

/**
 * Text analysis utilities for categorizing content
 */
class TextAnalyzer {
  /**
   * Determine the category of text based on content and context
   */
  static categorizeText(text: string, componentName: string, context: string): I18nKey['category'] {
    const normalizedText = text.toLowerCase().trim();
    const normalizedComponent = componentName.toLowerCase();
    const normalizedContext = context.toLowerCase();

    // Button text patterns
    if (normalizedComponent.includes('button') ||
        normalizedContext.includes('button') ||
        this.isButtonText(normalizedText)) {
      return 'button';
    }

    // Error message patterns
    if (this.isErrorText(normalizedText)) {
      return 'error';
    }

    // Placeholder patterns
    if (this.isPlaceholderText(normalizedText, normalizedContext)) {
      return 'placeholder';
    }

    // Title patterns
    if (this.isTitleText(normalizedText, normalizedComponent)) {
      return 'title';
    }

    // Label patterns
    if (this.isLabelText(normalizedText, normalizedComponent)) {
      return 'label';
    }

    // Tooltip patterns
    if (this.isTooltipText(normalizedText, normalizedContext)) {
      return 'tooltip';
    }

    // Description patterns
    if (this.isDescriptionText(normalizedText)) {
      return 'description';
    }

    return 'general';
  }

  /**
   * Check if text is button-like
   */
  private static isButtonText(text: string): boolean {
    const buttonKeywords = [
      'click', 'submit', 'save', 'cancel', 'delete', 'add', 'edit', 'remove',
      'login', 'logout', 'sign', 'register', 'continue', 'next', 'back',
      'confirm', 'approve', 'reject', 'accept', 'decline', 'buy', 'purchase',
      'download', 'upload', 'send', 'share', 'export', 'import'
    ];

    return buttonKeywords.some(keyword => text.includes(keyword)) ||
           (text.length <= 20 && text.split(' ').length <= 3);
  }

  /**
   * Check if text is error-related
   */
  private static isErrorText(text: string): boolean {
    const errorKeywords = [
      'error', 'invalid', 'required', 'failed', 'missing', 'incorrect',
      'denied', 'forbidden', 'unauthorized', 'expired', 'not found',
      'something went wrong', 'please try again'
    ];

    return errorKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * Check if text is placeholder text
   */
  private static isPlaceholderText(text: string, context: string): boolean {
    const placeholderKeywords = [
      'enter', 'type', 'search', 'select', 'choose', 'pick',
      'your', 'example', 'e.g.', 'placeholder'
    ];

    return context.includes('input') ||
           context.includes('field') ||
           context.includes('placeholder') ||
           placeholderKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * Check if text is title-like
   */
  private static isTitleText(text: string, component: string): boolean {
    return component.includes('title') ||
           component.includes('heading') ||
           component.includes('header') ||
           (text.length <= 50 && this.isCapitalized(text));
  }

  /**
   * Check if text is label-like
   */
  private static isLabelText(text: string, component: string): boolean {
    return component.includes('label') ||
           text.endsWith(':') ||
           (text.length <= 30 && text.split(' ').length <= 4);
  }

  /**
   * Check if text is tooltip text
   */
  private static isTooltipText(text: string, context: string): boolean {
    return context.includes('tooltip') ||
           context.includes('hint') ||
           text.startsWith('Tip:') ||
           text.startsWith('Help:');
  }

  /**
   * Check if text is description text
   */
  private static isDescriptionText(text: string): boolean {
    return text.length > 50 ||
           text.split(' ').length > 8 ||
           text.includes('This') ||
           text.includes('description');
  }

  /**
   * Check if text is capitalized (title case)
   */
  private static isCapitalized(text: string): boolean {
    const words = text.split(' ');
    return words.length > 0 && words[0][0] === words[0][0].toUpperCase();
  }
}

/**
 * Key generation utilities
 */
class KeyGenerator {
  private usedKeys = new Set<string>();

  /**
   * Generate a unique i18n key from text and component context
   */
  generateKey(text: string, componentName: string, category: I18nKey['category']): string {
    const baseKey = this.createBaseKey(text, componentName, category);
    return this.ensureUnique(baseKey);
  }

  /**
   * Create base key from components
   */
  private createBaseKey(text: string, componentName: string, category: I18nKey['category']): string {
    const normalizedComponent = this.normalizeComponentName(componentName);
    const normalizedText = this.normalizeText(text);

    // Different patterns based on category
    switch (category) {
      case 'button':
        return `${normalizedComponent}.${normalizedText}.action`;
      case 'label':
        return `${normalizedComponent}.${normalizedText}.label`;
      case 'title':
        return `${normalizedComponent}.${normalizedText}.title`;
      case 'description':
        return `${normalizedComponent}.${normalizedText}.description`;
      case 'error':
        return `errors.${normalizedText}`;
      case 'placeholder':
        return `placeholders.${normalizedText}`;
      case 'tooltip':
        return `tooltips.${normalizedText}`;
      default:
        return `${normalizedComponent}.${normalizedText}`;
    }
  }

  /**
   * Normalize component name for key generation
   */
  private normalizeComponentName(name: string): string {
    return name
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Normalize text for key generation
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 30) // Limit length
      .replace(/^_|_$/g, '');
  }

  /**
   * Ensure key uniqueness by adding suffix if needed
   */
  private ensureUnique(baseKey: string): string {
    let key = baseKey;
    let counter = 1;

    while (this.usedKeys.has(key)) {
      key = `${baseKey}_${counter}`;
      counter++;
    }

    this.usedKeys.add(key);
    return key;
  }

  /**
   * Reset used keys (for new extraction session)
   */
  reset(): void {
    this.usedKeys.clear();
  }
}

/**
 * Main I18n Key Mapper class
 */
export class I18nKeyMapper {
  private keyGenerator = new KeyGenerator();

  /**
   * Extract i18n keys from Figma components
   */
  async extractI18nKeys(
    components: ExtractedComponent[],
    languages: string[] = ['en']
  ): Promise<I18nExtractionResult> {
    this.keyGenerator.reset();

    const keys: I18nKey[] = [];
    const mappings: I18nMapping[] = [];
    const warnings: string[] = [];

    // Extract keys from all components
    for (const component of components) {
      const componentResult = this.extractFromComponent(component);
      keys.push(...componentResult.keys);
      mappings.push(componentResult.mapping);
      warnings.push(...componentResult.warnings);
    }

    // Generate translation files
    const files = this.generateI18nFiles(keys, languages);

    return {
      keys,
      files,
      mappings,
      warnings,
    };
  }

  /**
   * Extract i18n keys from a single component
   */
  private extractFromComponent(component: ExtractedComponent): {
    keys: I18nKey[];
    mapping: I18nMapping;
    warnings: string[];
  } {
    const keys: I18nKey[] = [];
    const textMappings: I18nMapping['textMappings'] = [];
    const warnings: string[] = [];

    // Extract from component's direct text content
    for (const text of component.textContent) {
      if (this.shouldTranslate(text)) {
        const key = this.createI18nKey(text, component.name, 'component');
        keys.push(key);

        textMappings.push({
          originalText: text,
          i18nKey: key.key,
          propName: this.inferPropName(text, component),
        });
      }
    }

    // Extract from child components recursively
    for (const child of component.children) {
      const childResult = this.extractFromComponent(child);
      keys.push(...childResult.keys);

      // Add child mappings with nested structure
      for (const mapping of childResult.mapping.textMappings) {
        textMappings.push({
          ...mapping,
          propName: `${child.name}.${mapping.propName}`,
        });
      }

      warnings.push(...childResult.warnings);
    }

    // Validate component for translation completeness
    if (component.textContent.length > 0 && textMappings.length === 0) {
      warnings.push(`Component ${component.name} contains text but no translatable content found`);
    }

    return {
      keys,
      mapping: {
        componentName: component.name,
        textMappings,
      },
      warnings,
    };
  }

  /**
   * Create an i18n key object
   */
  private createI18nKey(text: string, componentName: string, context: string): I18nKey {
    const category = TextAnalyzer.categorizeText(text, componentName, context);
    const key = this.keyGenerator.generateKey(text, componentName, category);

    return {
      key,
      value: text,
      description: this.generateDescription(text, componentName, category),
      context,
      componentName,
      category,
    };
  }

  /**
   * Generate description for i18n key
   */
  private generateDescription(text: string, componentName: string, category: I18nKey['category']): string {
    const descriptions: Record<I18nKey['category'], string> = {
      button: `Button text for ${componentName}`,
      label: `Label text for ${componentName}`,
      title: `Title text for ${componentName}`,
      description: `Description text for ${componentName}`,
      error: `Error message: ${text.substring(0, 50)}`,
      placeholder: `Placeholder text for input field`,
      tooltip: `Tooltip text for ${componentName}`,
      general: `Text content for ${componentName}`,
    };

    return descriptions[category];
  }

  /**
   * Infer prop name from text and component context
   */
  private inferPropName(text: string, component: ExtractedComponent): string {
    // Check if component has explicit text-related props
    const textProps = component.props.filter(prop =>
      ['text', 'label', 'title', 'children', 'content', 'placeholder'].includes(prop.name.toLowerCase())
    );

    if (textProps.length === 1) {
      return textProps[0].name;
    }

    // Infer based on text characteristics
    const category = TextAnalyzer.categorizeText(text, component.name, 'component');

    switch (category) {
      case 'button':
        return 'children';
      case 'label':
        return 'label';
      case 'title':
        return 'title';
      case 'placeholder':
        return 'placeholder';
      default:
        return 'children';
    }
  }

  /**
   * Check if text should be translated
   */
  private shouldTranslate(text: string): boolean {
    const trimmed = text.trim();

    // Skip empty or very short text
    if (trimmed.length < 2) {
      return false;
    }

    // Skip numbers only
    if (/^\d+$/.test(trimmed)) {
      return false;
    }

    // Skip common non-translatable patterns
    const skipPatterns = [
      /^https?:\/\//, // URLs
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, // Email addresses
      /^\$\d+/, // Price formats
      /^\d{4}-\d{2}-\d{2}/, // ISO dates
      /^#[0-9a-fA-F]{6}$/, // Hex colors
      /^Lorem ipsum/, // Lorem ipsum text
    ];

    return !skipPatterns.some(pattern => pattern.test(trimmed));
  }

  /**
   * Generate i18n translation files
   */
  private generateI18nFiles(keys: I18nKey[], languages: string[]): I18nFile[] {
    const files: I18nFile[] = [];

    for (const language of languages) {
      const translations: Record<string, string> = {};

      // Group keys by namespace for better organization
      const groupedKeys = this.groupKeysByNamespace(keys);

      // Build nested translation object
      for (const [namespace, namespaceKeys] of Object.entries(groupedKeys)) {
        for (const key of namespaceKeys) {
          translations[key.key] = language === 'en' ? key.value : `[${language.toUpperCase()}] ${key.value}`;
        }
      }

      files.push({
        language,
        translations,
        metadata: {
          generatedAt: new Date().toISOString(),
          source: 'figma',
          totalKeys: keys.length,
          components: [...new Set(keys.map(k => k.componentName))],
        },
      });
    }

    return files;
  }

  /**
   * Group keys by namespace for organization
   */
  private groupKeysByNamespace(keys: I18nKey[]): Record<string, I18nKey[]> {
    const grouped: Record<string, I18nKey[]> = {};

    for (const key of keys) {
      const namespace = key.key.split('.')[0];
      if (!grouped[namespace]) {
        grouped[namespace] = [];
      }
      grouped[namespace].push(key);
    }

    return grouped;
  }

  /**
   * Generate React i18n hook code
   */
  generateReactI18nHook(mapping: I18nMapping): string {
    const imports = [
      "import { useTranslation } from 'react-i18next';"
    ];

    const hookBody = `export const use${mapping.componentName}Translation = () => {
  const { t } = useTranslation();

  return {
${mapping.textMappings.map(tm => `    ${tm.propName}: t('${tm.i18nKey}'),`).join('\n')}
  };
};`;

    return `${imports.join('\n')}\n\n${hookBody}`;
  }

  /**
   * Generate TypeScript interfaces for translations
   */
  generateTranslationTypes(keys: I18nKey[]): string {
    const namespaces = [...new Set(keys.map(k => k.key.split('.')[0]))];

    const interfaces = namespaces.map(namespace => {
      const namespaceKeys = keys.filter(k => k.key.startsWith(namespace));
      const properties = namespaceKeys.map(k => {
        const keyPath = k.key.substring(namespace.length + 1);
        return `  /** ${k.description} */\n  '${k.key}': string;`;
      });

      return `export interface ${namespace.charAt(0).toUpperCase() + namespace.slice(1)}Translations {
${properties.join('\n')}
}`;
    });

    const mainInterface = `export interface Translations {
${namespaces.map(ns => `  ${ns}: ${ns.charAt(0).toUpperCase() + ns.slice(1)}Translations;`).join('\n')}
}`;

    return `${interfaces.join('\n\n')}\n\n${mainInterface}`;
  }
}

/**
 * Factory function to create i18n key mapper
 */
export function createI18nKeyMapper(): I18nKeyMapper {
  return new I18nKeyMapper();
}