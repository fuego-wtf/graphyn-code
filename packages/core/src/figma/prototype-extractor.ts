/**
 * Figma Prototype Extractor
 *
 * Connects to Figma API to extract design components, analyze design systems,
 * and prepare data for code generation. Handles complex component hierarchies,
 * design tokens, and maintains component relationships.
 */

import { FigmaOAuthHandler } from './figma-oauth-handler.js';

export interface FigmaFileInfo {
  key: string;
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  version: string;
  document: FigmaNode;
}

interface FigmaFileResponse {
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  version: string;
  document: FigmaNode;
}

interface FigmaComponentsResponse {
  meta?: {
    components?: Record<string, any>;
  };
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  backgroundColor?: FigmaColor;
  children?: FigmaNode[];
  absoluteBoundingBox?: FigmaBounds;
  constraints?: FigmaConstraints;
  fills?: FigmaFill[];
  strokes?: FigmaStroke[];
  effects?: FigmaEffect[];
  characters?: string;
  style?: FigmaTextStyle;
  componentId?: string;
  componentSetId?: string;
}

export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface FigmaBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FigmaConstraints {
  vertical: 'TOP' | 'BOTTOM' | 'CENTER' | 'TOP_BOTTOM' | 'SCALE';
  horizontal: 'LEFT' | 'RIGHT' | 'CENTER' | 'LEFT_RIGHT' | 'SCALE';
}

export interface FigmaFill {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'IMAGE';
  color?: FigmaColor;
  opacity?: number;
  gradientStops?: Array<{ position: number; color: FigmaColor }>;
  imageRef?: string;
}

export interface FigmaStroke {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL';
  color?: FigmaColor;
  opacity?: number;
  weight?: number;
}

export interface FigmaEffect {
  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';
  visible?: boolean;
  radius?: number;
  color?: FigmaColor;
  offset?: { x: number; y: number };
}

export interface FigmaTextStyle {
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  lineHeightPx?: number;
  letterSpacing?: number;
  textAlignHorizontal?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  textAlignVertical?: 'TOP' | 'CENTER' | 'BOTTOM';
  textCase?: 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE';
}

export interface ExtractedComponent {
  id: string;
  name: string;
  type: 'COMPONENT' | 'COMPONENT_SET' | 'INSTANCE';
  description?: string;
  figmaNode: FigmaNode;
  children: ExtractedComponent[];
  props: ComponentProperty[];
  styles: ComponentStyle;
  layout: ComponentLayout;
  textContent: string[];
  images: string[];
  variants?: ComponentVariant[];
}

export interface ComponentProperty {
  name: string;
  type: 'boolean' | 'string' | 'instance-swap' | 'variant';
  defaultValue: any;
  description?: string;
}

export interface ComponentStyle {
  backgroundColor?: string;
  border?: {
    width: number;
    style: string;
    color: string;
    radius?: number;
  };
  shadow?: {
    x: number;
    y: number;
    blur: number;
    spread: number;
    color: string;
  };
  typography?: {
    fontFamily: string;
    fontSize: string;
    fontWeight: string;
    lineHeight: string;
    color: string;
  };
}

export interface ComponentLayout {
  width: number | 'auto' | 'fill';
  height: number | 'auto' | 'fill';
  padding?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  gap?: number;
  direction?: 'row' | 'column';
  align?: 'start' | 'center' | 'end' | 'stretch' | 'space-between' | 'space-around';
  justify?: 'start' | 'center' | 'end' | 'space-between' | 'space-around';
}

export interface ComponentVariant {
  name: string;
  properties: Record<string, string>;
  node: FigmaNode;
}

/**
 * Main Figma Prototype Extractor class
 */
export class FigmaPrototypeExtractor {
  private oauthHandler: FigmaOAuthHandler;
  private baseUrl = 'https://api.figma.com/v1';

  constructor(oauthHandler: FigmaOAuthHandler) {
    this.oauthHandler = oauthHandler;
  }

  /**
   * Extract components from a Figma file URL
   */
  async extractFromUrl(figmaUrl: string): Promise<ExtractedComponent[]> {
    const fileKey = this.extractFileKeyFromUrl(figmaUrl);
    return this.extractFromFileKey(fileKey);
  }

  /**
   * Extract components from a Figma file key
   */
  async extractFromFileKey(fileKey: string): Promise<ExtractedComponent[]> {
    const fileInfo = await this.getFileInfo(fileKey);
    const components = await this.getFileComponents(fileKey);

    // Process main document nodes
    const extractedComponents: ExtractedComponent[] = [];

    for (const page of fileInfo.document.children || []) {
      if (page.type === 'CANVAS') {
        const pageComponents = await this.extractComponentsFromNode(page, components);
        extractedComponents.push(...pageComponents);
      }
    }

    // Add component set relationships
    this.resolveComponentRelationships(extractedComponents);

    return extractedComponents;
  }

  /**
   * Get detailed file information from Figma API
   */
  async getFileInfo(fileKey: string): Promise<FigmaFileInfo> {
    const accessToken = await this.oauthHandler.getAccessToken();

    const response = await fetch(`${this.baseUrl}/files/${fileKey}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Figma file: ${response.status} ${await response.text()}`);
    }

    const data = await response.json() as FigmaFileResponse;
    return {
      key: fileKey,
      name: data.name,
      lastModified: data.lastModified,
      thumbnailUrl: data.thumbnailUrl,
      version: data.version,
      document: data.document,
    };
  }

  /**
   * Get component metadata from Figma API
   */
  async getFileComponents(fileKey: string): Promise<Record<string, any>> {
    const accessToken = await this.oauthHandler.getAccessToken();

    const response = await fetch(`${this.baseUrl}/files/${fileKey}/components`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Figma components: ${response.status} ${await response.text()}`);
    }

    const data = await response.json() as FigmaComponentsResponse;
    return data.meta?.components || {};
  }

  /**
   * Extract component data from a Figma node
   */
  private async extractComponentsFromNode(
    node: FigmaNode,
    componentMeta: Record<string, any>
  ): Promise<ExtractedComponent[]> {
    const components: ExtractedComponent[] = [];

    if (this.isComponentNode(node)) {
      const component = await this.processComponentNode(node, componentMeta);
      if (component) {
        components.push(component);
      }
    }

    // Recursively process children
    if (node.children) {
      for (const child of node.children) {
        const childComponents = await this.extractComponentsFromNode(child, componentMeta);
        components.push(...childComponents);
      }
    }

    return components;
  }

  /**
   * Process a single component node into ExtractedComponent
   */
  private async processComponentNode(
    node: FigmaNode,
    componentMeta: Record<string, any>
  ): Promise<ExtractedComponent | null> {
    const meta = componentMeta[node.id];

    const component: ExtractedComponent = {
      id: node.id,
      name: this.sanitizeComponentName(node.name),
      type: node.type as any,
      description: meta?.description,
      figmaNode: node,
      children: [],
      props: this.extractProperties(node, meta),
      styles: this.extractStyles(node),
      layout: this.extractLayout(node),
      textContent: this.extractTextContent(node),
      images: this.extractImages(node),
    };

    // Process component variants if this is a component set
    if (node.type === 'COMPONENT_SET') {
      component.variants = this.extractVariants(node);
    }

    // Process child components
    if (node.children) {
      for (const child of node.children) {
        if (this.isSignificantChild(child)) {
          const childComponent = await this.processComponentNode(child, componentMeta);
          if (childComponent) {
            component.children.push(childComponent);
          }
        }
      }
    }

    return component;
  }

  /**
   * Extract component properties from Figma node
   */
  private extractProperties(node: FigmaNode, meta: any): ComponentProperty[] {
    const properties: ComponentProperty[] = [];

    // Extract from component metadata
    if (meta?.componentPropertyDefinitions) {
      for (const [name, def] of Object.entries(meta.componentPropertyDefinitions)) {
        properties.push({
          name: this.camelCase(name),
          type: (def as any).type?.toLowerCase() || 'string',
          defaultValue: (def as any).defaultValue,
          description: (def as any).description,
        });
      }
    }

    // Infer common properties from structure
    if (node.children) {
      const hasText = node.children.some(child => child.type === 'TEXT');
      const hasIcon = node.children.some(child =>
        child.name.toLowerCase().includes('icon') ||
        child.type === 'VECTOR'
      );

      if (hasText) {
        properties.push({
          name: 'children',
          type: 'string',
          defaultValue: this.extractTextContent(node)[0] || 'Button',
          description: 'Text content',
        });
      }

      if (hasIcon) {
        properties.push({
          name: 'icon',
          type: 'string',
          defaultValue: undefined,
          description: 'Icon component or name',
        });
      }
    }

    return properties;
  }

  /**
   * Extract CSS-compatible styles from Figma node
   */
  private extractStyles(node: FigmaNode): ComponentStyle {
    const styles: ComponentStyle = {};

    // Background color
    if (node.fills && node.fills.length > 0) {
      const fill = node.fills[0];
      if (fill.type === 'SOLID' && fill.color) {
        styles.backgroundColor = this.figmaColorToCss(fill.color, fill.opacity);
      }
    }

    // Border and border radius
    if (node.strokes && node.strokes.length > 0) {
      const stroke = node.strokes[0];
      if (stroke.type === 'SOLID' && stroke.color) {
        styles.border = {
          width: stroke.weight || 1,
          style: 'solid',
          color: this.figmaColorToCss(stroke.color, stroke.opacity),
          radius: (node as any).cornerRadius || 0,
        };
      }
    }

    // Shadow effects
    if (node.effects) {
      const dropShadow = node.effects.find(effect => effect.type === 'DROP_SHADOW');
      if (dropShadow && dropShadow.visible !== false) {
        styles.shadow = {
          x: dropShadow.offset?.x || 0,
          y: dropShadow.offset?.y || 0,
          blur: dropShadow.radius || 0,
          spread: 0,
          color: dropShadow.color ? this.figmaColorToCss(dropShadow.color) : 'rgba(0,0,0,0.25)',
        };
      }
    }

    // Typography (for text nodes)
    if (node.type === 'TEXT' && node.style) {
      styles.typography = {
        fontFamily: node.style.fontFamily,
        fontSize: `${node.style.fontSize}px`,
        fontWeight: node.style.fontWeight.toString(),
        lineHeight: node.style.lineHeightPx ? `${node.style.lineHeightPx}px` : 'normal',
        color: node.fills?.[0]?.color ? this.figmaColorToCss(node.fills[0].color) : '#000000',
      };
    }

    return styles;
  }

  /**
   * Extract layout information from Figma node
   */
  private extractLayout(node: FigmaNode): ComponentLayout {
    const layout: ComponentLayout = {
      width: node.absoluteBoundingBox?.width || 'auto',
      height: node.absoluteBoundingBox?.height || 'auto',
    };

    // Auto layout properties
    const autoLayout = (node as any);
    if (autoLayout.layoutMode) {
      layout.direction = autoLayout.layoutMode === 'HORIZONTAL' ? 'row' : 'column';
      layout.gap = autoLayout.itemSpacing || 0;

      // Padding
      if (autoLayout.paddingLeft !== undefined) {
        layout.padding = {
          top: autoLayout.paddingTop || 0,
          right: autoLayout.paddingRight || 0,
          bottom: autoLayout.paddingBottom || 0,
          left: autoLayout.paddingLeft || 0,
        };
      }

      // Alignment
      if (autoLayout.primaryAxisAlignItems) {
        layout.justify = this.figmaAlignmentToCss(autoLayout.primaryAxisAlignItems);
      }

      if (autoLayout.counterAxisAlignItems) {
        layout.align = this.figmaAlignmentToCss(autoLayout.counterAxisAlignItems);
      }
    }

    return layout;
  }

  /**
   * Extract all text content from node and children
   */
  private extractTextContent(node: FigmaNode): string[] {
    const textContent: string[] = [];

    if (node.type === 'TEXT' && node.characters) {
      textContent.push(node.characters);
    }

    if (node.children) {
      for (const child of node.children) {
        textContent.push(...this.extractTextContent(child));
      }
    }

    return textContent;
  }

  /**
   * Extract image references from node
   */
  private extractImages(node: FigmaNode): string[] {
    const images: string[] = [];

    if (node.fills) {
      for (const fill of node.fills) {
        if (fill.type === 'IMAGE' && fill.imageRef) {
          images.push(fill.imageRef);
        }
      }
    }

    if (node.children) {
      for (const child of node.children) {
        images.push(...this.extractImages(child));
      }
    }

    return images;
  }

  /**
   * Extract component variants from component set
   */
  private extractVariants(node: FigmaNode): ComponentVariant[] {
    if (node.type !== 'COMPONENT_SET' || !node.children) {
      return [];
    }

    return node.children.map(child => ({
      name: child.name,
      properties: this.parseVariantProperties(child.name),
      node: child,
    }));
  }

  /**
   * Parse variant properties from component name
   * Example: "Button=Primary, Size=Large" -> { Button: "Primary", Size: "Large" }
   */
  private parseVariantProperties(name: string): Record<string, string> {
    const properties: Record<string, string> = {};

    const pairs = name.split(',').map(s => s.trim());
    for (const pair of pairs) {
      const [key, value] = pair.split('=').map(s => s.trim());
      if (key && value) {
        properties[key] = value;
      }
    }

    return properties;
  }

  /**
   * Check if node represents a component
   */
  private isComponentNode(node: FigmaNode): boolean {
    return ['COMPONENT', 'COMPONENT_SET', 'INSTANCE'].includes(node.type);
  }

  /**
   * Check if child node is significant for component structure
   */
  private isSignificantChild(node: FigmaNode): boolean {
    // Skip purely decorative elements
    if (node.name.startsWith('_') || node.name.toLowerCase().includes('background')) {
      return false;
    }

    // Include meaningful elements
    return ['COMPONENT', 'INSTANCE', 'TEXT', 'VECTOR', 'FRAME'].includes(node.type);
  }

  /**
   * Resolve relationships between components
   */
  private resolveComponentRelationships(components: ExtractedComponent[]): void {
    const componentMap = new Map(components.map(c => [c.id, c]));

    for (const component of components) {
      // Link component instances to their masters
      if (component.type === 'INSTANCE' && component.figmaNode.componentId) {
        const master = componentMap.get(component.figmaNode.componentId);
        if (master) {
          component.description = `Instance of ${master.name}`;
        }
      }

      // Link component variants to their sets
      if (component.figmaNode.componentSetId) {
        const componentSet = componentMap.get(component.figmaNode.componentSetId);
        if (componentSet) {
          component.description = `Variant of ${componentSet.name}`;
        }
      }
    }
  }

  /**
   * Extract file key from Figma URL
   */
  private extractFileKeyFromUrl(url: string): string {
    const match = url.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]{22,128})/);
    if (!match) {
      throw new Error('Invalid Figma URL. Expected format: https://figma.com/file/KEY/...');
    }
    return match[1];
  }

  /**
   * Convert Figma color to CSS color string
   */
  private figmaColorToCss(color: FigmaColor, opacity?: number): string {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    const a = opacity !== undefined ? opacity : color.a;

    if (a < 1) {
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }

    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * Convert Figma alignment to CSS alignment
   */
  private figmaAlignmentToCss(alignment: string): 'start' | 'center' | 'end' | 'space-between' | 'space-around' {
    const alignmentMap: Record<string, any> = {
      'MIN': 'start',
      'CENTER': 'center',
      'MAX': 'end',
      'SPACE_BETWEEN': 'space-between',
    };

    return alignmentMap[alignment] || 'start';
  }

  /**
   * Sanitize component name for code generation
   */
  private sanitizeComponentName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9]/g, '')
      .replace(/^(\d)/, '_$1') // Prefix with underscore if starts with number
      || 'Component';
  }

  /**
   * Convert string to camelCase
   */
  private camelCase(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase());
  }
}
