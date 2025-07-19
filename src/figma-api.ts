import axios, { AxiosInstance } from 'axios';
import fs from 'fs';
import path from 'path';
import https from 'https';

interface FigmaFile {
  name: string;
  lastModified: string;
  version: string;
  document: FigmaDocument;
}

interface FigmaDocument {
  id: string;
  name: string;
  type: string;
  children: FigmaNode[];
}

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  // Navigation properties for prototypes
  transitionNodeID?: string;
  transitionDuration?: number;
  transitionEasing?: string;
  // Component properties
  componentId?: string;
  isInstance?: boolean;
}

interface FigmaPrototypeFlow {
  fileKey: string;
  fileName: string;
  screens: PrototypeScreen[];
  navigation: NavigationLink[];
  components: ComponentInfo[];
  totalScreens: number;
  totalComponents: number;
}

interface PrototypeScreen {
  id: string;
  name: string;
  frameId: string;
  components: string[];
  navigatesTo: string[];
}

interface NavigationLink {
  from: string;
  to: string;
  trigger?: string;
  action?: string;           // NAVIGATE, SWAP, OVERLAY, etc.
  transition?: string;       // DISSOLVE, SLIDE_IN, etc.
  duration?: number;         // Animation duration
  preserveScrollPosition?: boolean;
}

interface TextContent {
  id: string;
  text: string;
  key: string;
  componentId?: string;
  style?: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    lineHeight?: number;
    letterSpacing?: number;
  };
}

interface ComponentInfo {
  id: string;
  name: string;
  type: string;
  parentScreen: string;
  instances: number;
  properties?: Record<string, any>;
  children?: ComponentInfo[];
  isReusable?: boolean;
  variants?: string[];
  boundingBox?: { x: number; y: number; width: number; height: number };
  componentSetId?: string;
  description?: string;
  texts?: TextContent[];
  i18nKeys?: string[];
}

interface ComponentMap {
  designTokens: {
    colors: Record<string, string>;
    typography: Record<string, any>;
    spacing: Record<string, number>;
  };
  atomicComponents: ComponentInfo[];  // Buttons, Icons, etc.
  molecules: ComponentInfo[];          // Cards, Form fields, etc.
  organisms: ComponentInfo[];          // Headers, Sections, etc.
  templates: ComponentInfo[];          // Full layouts
  componentSets: Record<string, ComponentInfo[]>; // Grouped variants
  translations?: {
    extracted: Record<string, string>;     // key -> original text
    keyMapping: Record<string, string>;    // key -> componentId
    languages: {
      en: Record<string, string>;          // Base language translations
      [key: string]: Record<string, string>; // Other languages
    };
  };
}

export class FigmaAPIClient {
  private client: AxiosInstance;

  constructor(token: string) {
    this.client = axios.create({
      baseURL: 'https://api.figma.com/v1',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  /**
   * Parse a Figma URL to extract file key and node ID
   */
  parseUrl(url: string): { fileKey: string; nodeId?: string } {
    // Handle various Figma URL formats
    const patterns = [
      // https://www.figma.com/file/ABC123/File-Name?node-id=1%3A2
      /figma\.com\/file\/([^\/]+).*node-id=([^&]+)/,
      // https://www.figma.com/design/ABC123/File-Name?node-id=1-2
      /figma\.com\/design\/([^\/]+).*node-id=([^&]+)/,
      // https://www.figma.com/proto/ABC123/File-Name?node-id=1%3A2 or node-id=1568-55865
      /figma\.com\/proto\/([^\/]+).*node-id=([^&]+)/,
      // Prototype URLs with starting-point-node-id
      /figma\.com\/proto\/([^\/]+).*starting-point-node-id=([^&]+)/,
      // Simple file URL without node
      /figma\.com\/(?:file|design|proto)\/([^\/\?]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        const fileKey = match[1];
        let nodeId = match[2] ? decodeURIComponent(match[2]) : undefined;
        
        // Handle different node ID formats
        if (nodeId) {
          // Convert 1568-55865 to 1568:55865
          if (nodeId.includes('-') && !nodeId.includes(':')) {
            nodeId = nodeId.replace('-', ':');
          }
          // Handle URL encoded formats like 1%3A2
          nodeId = nodeId.replace('%3A', ':');
        }
        
        console.log(`Parsed Figma URL: fileKey=${fileKey}, nodeId=${nodeId}`);
        return { fileKey, nodeId };
      }
    }

    throw new Error('Invalid Figma URL format');
  }

  /**
   * Fetch a Figma file
   */
  async getFile(fileKey: string, options?: { geometry?: string; depth?: number }): Promise<FigmaFile> {
    try {
      const params = new URLSearchParams();
      
      // Add query parameters to reduce response size
      if (options?.geometry) {
        params.append('geometry', options.geometry);
      }
      if (options?.depth) {
        params.append('depth', options.depth.toString());
      }
      
      // Default to minimal geometry to avoid "request too large" errors
      if (!params.has('geometry')) {
        params.append('geometry', 'paths');
      }
      
      const url = `/files/${fileKey}${params.toString() ? '?' + params.toString() : ''}`;
      const response = await this.client.get(url);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('Invalid Figma token or no access to file');
      }
      if (error.response?.status === 400 && error.response?.data?.err?.includes('Request too large')) {
        throw new Error('Figma file is too large. Try specifying a specific node ID in the URL.');
      }
      throw new Error(`Failed to fetch Figma file: ${error.message}`);
    }
  }

  /**
   * Fetch specific nodes from a Figma file
   */
  async getNodes(fileKey: string, nodeIds: string[]): Promise<any> {
    try {
      // Figma API has a limit on URL length, so batch large requests
      const MAX_NODES_PER_REQUEST = 50;
      
      if (nodeIds.length > MAX_NODES_PER_REQUEST) {
        console.log(`Batching ${nodeIds.length} nodes into multiple requests...`);
        
        const results: any = { nodes: {} };
        
        for (let i = 0; i < nodeIds.length; i += MAX_NODES_PER_REQUEST) {
          const batch = nodeIds.slice(i, i + MAX_NODES_PER_REQUEST);
          const idsParam = batch.join(',');
          const url = `/files/${fileKey}/nodes?ids=${idsParam}`;
          
          console.log(`Fetching batch ${Math.floor(i / MAX_NODES_PER_REQUEST) + 1}/${Math.ceil(nodeIds.length / MAX_NODES_PER_REQUEST)}...`);
          
          const response = await this.client.get(url);
          
          if (response.data.err) {
            console.error(`Figma API error: ${response.data.err}`);
            throw new Error(`Figma API error: ${response.data.err}`);
          }
          
          if (response.data.nodes) {
            Object.assign(results.nodes, response.data.nodes);
          }
          
          // Add delay between batches to avoid rate limiting
          if (i + MAX_NODES_PER_REQUEST < nodeIds.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
        
        console.log(`Fetched ${Object.keys(results.nodes).length} nodes in total`);
        return results;
      }
      
      // For small requests, use original logic
      const idsParam = nodeIds.join(',');
      const url = `/files/${fileKey}/nodes?ids=${idsParam}`;
      console.log(`Fetching nodes: ${url}`);
      
      const response = await this.client.get(url);
      console.log(`Node response keys: ${Object.keys(response.data).join(', ')}`);
      
      // Check for error in response
      if (response.data.err) {
        console.error(`Figma API error: ${response.data.err}`);
        throw new Error(`Figma API error: ${response.data.err}`);
      }
      
      if (response.data.nodes) {
        const nodeKeys = Object.keys(response.data.nodes);
        console.log(`Found ${nodeKeys.length} nodes: ${nodeKeys.join(', ')}`);
      }
      
      return response.data;
    } catch (error: any) {
      console.error(`Error fetching nodes: ${error.response?.status} - ${error.message}`);
      if (error.response?.status === 403) {
        throw new Error('Invalid Figma token or no access to file');
      }
      if (error.response?.status === 404) {
        throw new Error('Figma file or node not found');
      }
      throw new Error(`Failed to fetch Figma nodes: ${error.message}`);
    }
  }

  /**
   * Analyze real prototype by following actual transitions
   */
  async analyzeSpecificNode(fileKey: string, startNodeId: string, progressCallback?: (message: string) => void): Promise<FigmaPrototypeFlow> {
    try {
      const screens: PrototypeScreen[] = [];
      const navigation: NavigationLink[] = [];
      const components: ComponentInfo[] = [];
      const visited = new Set<string>();
      const toVisit = [startNodeId];
      
      progressCallback?.(`Starting from frame ${startNodeId}...`);
      
      // Follow all transitions to discover real screens
      while (toVisit.length > 0) {
        const currentNodeId = toVisit.shift()!;
        if (visited.has(currentNodeId)) continue;
        visited.add(currentNodeId);
        
        progressCallback?.(`Analyzing frame ${currentNodeId}... (${visited.size} screens found)`);
        
        try {
          // Get node details with depth to see transitions
          const nodeData = await this.getNodes(fileKey, [currentNodeId]);
          const node = nodeData.nodes[currentNodeId];
          
          if (!node) {
            progressCallback?.(`⚠️  Frame ${currentNodeId} not accessible, skipping...`);
            continue;
          }
          
          // Handle both document structure and direct node structure
          const doc = node.document || node;
          
          progressCallback?.(`✓ Found: ${doc.name || `Frame ${currentNodeId}`}`);
          
          // Log node structure for debugging
          console.log(`Node structure for ${currentNodeId}:`, {
            type: doc.type,
            name: doc.name,
            hasChildren: !!doc.children,
            childCount: doc.children?.length || 0,
            hasTransition: !!doc.transitionNodeID,
            hasInteractions: !!doc.interactions
          });
          
          // Create screen from real frame data
          const screen: PrototypeScreen = {
            id: currentNodeId,
            name: doc.name || `Frame ${currentNodeId}`,
            frameId: currentNodeId,
            components: [],
            navigatesTo: []
          };
          
          // Find transitions in the document
          if (doc.transitionNodeID) {
            screen.navigatesTo.push(doc.transitionNodeID);
            if (!visited.has(doc.transitionNodeID)) {
              toVisit.push(doc.transitionNodeID);
              progressCallback?.(`🔗 Found navigation to ${doc.transitionNodeID}`);
            }
            
            navigation.push({
              from: currentNodeId,
              to: doc.transitionNodeID,
              trigger: 'click',
              action: 'NAVIGATE'
            });
          }
          
          // Check interactions for more navigation
          if (doc.interactions) {
            doc.interactions.forEach((interaction: any) => {
              if (interaction.actions) {
                interaction.actions.forEach((action: any) => {
                  if (action.destinationId && action.navigation === 'NAVIGATE') {
                    if (!screen.navigatesTo.includes(action.destinationId)) {
                      screen.navigatesTo.push(action.destinationId);
                    }
                    if (!visited.has(action.destinationId)) {
                      toVisit.push(action.destinationId);
                    }
                    
                    navigation.push({
                      from: currentNodeId,
                      to: action.destinationId,
                      trigger: interaction.trigger?.type || 'click',
                      action: action.navigation || 'NAVIGATE',
                      transition: action.transition?.type,
                      duration: action.transition?.duration,
                      preserveScrollPosition: action.preserveScrollPosition
                    });
                  }
                });
              }
            });
          }
          
          // Check children for interactions
          if (doc.children) {
            this.findChildTransitions(doc.children, currentNodeId, screen, toVisit, visited, navigation);
          }
          
          screens.push(screen);
          
          // Add basic component info
          components.push({
            id: currentNodeId,
            name: doc.name || 'Frame Component',
            type: doc.type || 'FRAME',
            parentScreen: currentNodeId,
            instances: 1
          });
          
        } catch (error: any) {
          progressCallback?.(`❌ Error analyzing ${currentNodeId}: ${error.message}`);
        }
      }
      
      progressCallback?.(`🎉 Analysis complete! Found ${screens.length} screens with ${navigation.length} connections`);
      
      return {
        fileKey,
        fileName: 'Graphyn Prototype',
        screens,
        navigation,
        components,
        totalScreens: screens.length,
        totalComponents: components.length
      };
    } catch (error: any) {
      throw new Error(`Failed to analyze prototype: ${error.message}`);
    }
  }

  /**
   * Find transitions in child nodes
   */
  private findChildTransitions(
    children: any[], 
    parentId: string, 
    screen: PrototypeScreen,
    toVisit: string[],
    visited: Set<string>,
    navigation: NavigationLink[]
  ) {
    children.forEach(child => {
      if (child.transitionNodeID) {
        if (!screen.navigatesTo.includes(child.transitionNodeID)) {
          screen.navigatesTo.push(child.transitionNodeID);
        }
        if (!visited.has(child.transitionNodeID)) {
          toVisit.push(child.transitionNodeID);
        }
        
        navigation.push({
          from: parentId,
          to: child.transitionNodeID,
          trigger: 'click'
        });
      }
      
      if (child.interactions) {
        child.interactions.forEach((interaction: any) => {
          if (interaction.actions) {
            interaction.actions.forEach((action: any) => {
              if (action.destinationId && action.navigation === 'NAVIGATE') {
                if (!screen.navigatesTo.includes(action.destinationId)) {
                  screen.navigatesTo.push(action.destinationId);
                }
                if (!visited.has(action.destinationId)) {
                  toVisit.push(action.destinationId);
                }
                
                navigation.push({
                  from: parentId,
                  to: action.destinationId,
                  trigger: interaction.trigger?.type || 'click'
                });
              }
            });
          }
        });
      }
      
      // Recursively check child's children
      if (child.children) {
        this.findChildTransitions(child.children, parentId, screen, toVisit, visited, navigation);
      }
    });
  }

  /**
   * Get all frames in a prototype flow starting from a specific node
   */
  async getPrototypeFlow(fileKey: string, startNodeId: string): Promise<any[]> {
    const visited = new Set<string>();
    const frames: any[] = [];
    const toVisit = [startNodeId];
    
    while (toVisit.length > 0) {
      const currentId = toVisit.shift()!;
      
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      
      try {
        const nodeData = await this.getNodes(fileKey, [currentId]);
        const node = nodeData.nodes[currentId];
        
        if (node) {
          // Extract navigation targets from the node
          const navigationTargets = this.extractNavigationTargets(node);
          
          frames.push({
            id: currentId,
            name: node.name,
            type: node.type,
            navigatesTo: navigationTargets,
            children: node.children || []
          });
          
          // Add navigation targets to visit queue
          navigationTargets.forEach(targetId => {
            if (!visited.has(targetId)) {
              toVisit.push(targetId);
            }
          });
        }
      } catch (error: any) {
        // If we can't fetch a specific node, that's ok - continue with others
        console.warn(`Could not fetch node ${currentId}:`, error.message);
      }
    }
    
    return frames;
  }

  /**
   * Extract navigation targets from a node
   */
  private extractNavigationTargets(node: any): string[] {
    const targets: string[] = [];
    
    // Check direct transition
    if (node.transitionNodeID) {
      targets.push(node.transitionNodeID);
    }
    
    // Check children for interactions
    if (node.children) {
      this.traverseNodeForNavigation(node, targets);
    }
    
    return targets;
  }

  /**
   * Traverse node tree to find navigation interactions
   */
  private traverseNodeForNavigation(node: any, targets: string[]) {
    if (node.transitionNodeID && !targets.includes(node.transitionNodeID)) {
      targets.push(node.transitionNodeID);
    }
    
    if (node.children) {
      node.children.forEach((child: any) => {
        this.traverseNodeForNavigation(child, targets);
      });
    }
  }



  /**
   * Analyze a prototype and extract all screens and navigation
   */
  async analyzePrototype(url: string, progressCallback?: (message: string) => void): Promise<FigmaPrototypeFlow> {
    const { fileKey, nodeId } = this.parseUrl(url);
    
    progressCallback?.('Parsing Figma URL...');
    
    // For prototype URLs with specific node IDs, use prototype-specific analysis
    if (nodeId && url.includes('/proto/')) {
      progressCallback?.('Detected prototype URL - using specialized analysis...');
      return this.analyzePrototypeFile(fileKey, nodeId, progressCallback);
    }
    
    progressCallback?.('Fetching file structure...');
    
    // For full file analysis
    let file: FigmaFile;
    try {
      file = await this.getFile(fileKey, { geometry: 'paths' });
      progressCallback?.('File loaded successfully!');
    } catch (error: any) {
      if (error.message.includes('too large') && nodeId) {
        progressCallback?.('File too large, using node-specific analysis...');
        // Fall back to simplified node analysis
        return this.analyzeSpecificNode(fileKey, nodeId, progressCallback);
      }
      throw error;
    }
    
    // Find all frames (screens) in the document
    const screens: PrototypeScreen[] = [];
    const navigation: NavigationLink[] = [];
    const components: ComponentInfo[] = [];
    
    // If nodeId is specified, start from that node
    const startNode = nodeId ? this.findNodeById(file.document, nodeId) : file.document;
    if (!startNode) {
      throw new Error(`Node ${nodeId} not found in file`);
    }
    
    // Traverse the document tree to find frames and components
    this.traverseNode(startNode, (node, parent) => {
      // Frames are typically screens in Figma
      if (node.type === 'FRAME' && parent?.type === 'CANVAS') {
        const screen: PrototypeScreen = {
          id: node.id,
          name: node.name,
          frameId: node.id,
          components: [],
          navigatesTo: []
        };
        
        // Find components within this frame
        this.traverseNode(node, (child) => {
          if (child.type === 'COMPONENT' || child.isInstance) {
            screen.components.push(child.id);
            
            const componentInfo: ComponentInfo = {
              id: child.id,
              name: child.name,
              type: child.type,
              parentScreen: screen.id,
              instances: 1
            };
            
            // Check if this component already exists
            const existing = components.find(c => c.name === child.name && c.type === child.type);
            if (existing) {
              existing.instances++;
            } else {
              components.push(componentInfo);
            }
          }
          
          // Check for navigation links
          if (child.transitionNodeID) {
            screen.navigatesTo.push(child.transitionNodeID);
            navigation.push({
              from: screen.id,
              to: child.transitionNodeID,
              trigger: 'click' // Default trigger
            });
          }
        });
        
        screens.push(screen);
      }
    });
    
    return {
      fileKey,
      fileName: file.name,
      screens,
      navigation,
      components,
      totalScreens: screens.length,
      totalComponents: components.length
    };
  }

  /**
   * Find a node by ID in the document tree
   */
  private findNodeById(node: FigmaNode, targetId: string): FigmaNode | null {
    if (node.id === targetId) {
      return node;
    }
    
    if (node.children) {
      for (const child of node.children) {
        const found = this.findNodeById(child, targetId);
        if (found) return found;
      }
    }
    
    return null;
  }

  /**
   * Traverse the node tree and execute callback
   */
  private traverseNode(node: FigmaNode, callback: (node: FigmaNode, parent?: FigmaNode) => void, parent?: FigmaNode) {
    callback(node, parent);
    
    if (node.children) {
      for (const child of node.children) {
        this.traverseNode(child, callback, node);
      }
    }
  }

  /**
   * Generate semantic component name from screen name
   */
  private generateComponentName(screenName: string): string {
    // Convert screen names to proper React component names
    const nameMap: Record<string, string> = {
      'landing': 'LandingPage',
      'sign up': 'SignUpPage', 
      'signup': 'SignUpPage',
      'login': 'LoginPage',
      'signin': 'SignInPage',
      'sign in': 'SignInPage',
      'dashboard': 'Dashboard',
      'home': 'HomePage',
      'profile': 'ProfilePage',
      'settings': 'SettingsPage',
      'create organization': 'CreateOrganizationPage',
      'organization': 'OrganizationPage',
      'thread list': 'ThreadListPage',
      'threads': 'ThreadListPage',
      'chat': 'ChatPage',
      'conversation': 'ConversationPage',
      'agent creation': 'AgentCreationPage',
      'agent builder': 'AgentBuilderPage',
      'testing': 'TestingPage',
      'whatsapp': 'WhatsAppStyleChat'
    };

    const cleanName = screenName.toLowerCase()
      .replace(/frame\s*\d+:?\s*/g, '') // Remove "Frame 1:", "Frame2", etc.
      .replace(/[^a-zA-Z\s]/g, '') // Remove special characters
      .trim();

    // Check for exact matches first
    if (nameMap[cleanName]) {
      return nameMap[cleanName];
    }

    // Check for partial matches
    for (const [key, value] of Object.entries(nameMap)) {
      if (cleanName.includes(key) || key.includes(cleanName)) {
        return value;
      }
    }

    // Fallback: convert to PascalCase
    return cleanName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('') + 'Page';
  }

  /**
   * Generate implementation plan from prototype analysis
   */
  generateImplementationPlan(prototype: FigmaPrototypeFlow): ImplementationPlan {
    const tasks: ImplementationTask[] = [];
    
    // Only create tasks if we have real screens
    if (prototype.screens.length === 0) {
      tasks.push({
        id: 'discovery',
        title: 'Discover prototype screens via MCP',
        frameId: '',
        description: 'Use Figma MCP tools to explore the prototype structure',
        subtasks: [],
        priority: 'high',
        components: 0
      });
    } else {
      // Create tasks for each real screen found
      prototype.screens.forEach((screen, index) => {
        const componentName = this.generateComponentName(screen.name);
        const task: ImplementationTask = {
          id: `component-${componentName.toLowerCase()}`,
          title: `Implement ${componentName}`,
          frameId: screen.frameId,
          description: `${componentName} component (Figma Frame: ${screen.frameId})`,
          subtasks: [],
          priority: index === 0 ? 'high' : 'medium',
          components: screen.components.length
        };
        
        // Add component subtasks with semantic names
        const screenComponents = prototype.components.filter(c => c.parentScreen === screen.id);
        screenComponents.forEach(component => {
          task.subtasks.push({
            id: `subcomponent-${component.id}`,
            title: `Build ${component.name} component`,
            type: component.type
          });
        });
        
        // Add navigation subtasks if applicable
        if (screen.navigatesTo.length > 0) {
          const navTargets = screen.navigatesTo.map(id => {
            const targetScreen = prototype.screens.find(s => s.id === id);
            return targetScreen ? this.generateComponentName(targetScreen.name) : id;
          }).join(', ');
          
          task.subtasks.push({
            id: `nav-${screen.id}`,
            title: `Add navigation to: ${navTargets}`,
            type: 'NAVIGATION'
          });
        }
        
        tasks.push(task);
      });
      
      // Add setup task only if we have components
      if (prototype.components.length > 0) {
        tasks.unshift({
          id: 'setup',
          title: 'Set up React component structure',
          frameId: '',
          description: 'Create component folders and base configuration',
          subtasks: [],
          priority: 'high',
          components: 0
        });
      }
      
      // Add routing task only if we have actual navigation
      if (prototype.navigation.length > 0) {
        tasks.push({
          id: 'routing',
          title: 'Configure React Router',
          frameId: '',
          description: 'Set up routing between screens',
          subtasks: prototype.navigation.map((nav, i) => ({
            id: `route-${i}`,
            title: `Route: ${this.getScreenName(prototype, nav.from)} → ${this.getScreenName(prototype, nav.to)}`,
            type: 'ROUTE'
          })),
          priority: 'medium',
          components: 0
        });
      }
    }
    
    return {
      tasks,
      summary: {
        totalScreens: prototype.totalScreens,
        totalComponents: prototype.totalComponents,
        totalTasks: tasks.length,
        estimatedHours: Math.max(1, Math.ceil((prototype.totalScreens * 2) + (prototype.totalComponents * 0.5)))
      }
    };
  }

  private getScreenName(prototype: FigmaPrototypeFlow, screenId: string): string {
    const screen = prototype.screens.find(s => s.id === screenId);
    return screen ? screen.name : 'Unknown Screen';
  }

  /**
   * Get image URL for a frame
   */
  async getFrameImage(frameId: string, fileKey?: string): Promise<string> {
    try {
      // Extract file key from instance if not provided
      const actualFileKey = fileKey || this.currentFileKey;
      if (!actualFileKey) {
        throw new Error('File key required for image generation');
      }

      const response = await this.client.get(`/images/${actualFileKey}?ids=${frameId}&format=png&scale=2`);
      
      if (!response.data.images || !response.data.images[frameId]) {
        throw new Error('No image URL returned from Figma API');
      }
      
      return response.data.images[frameId];
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('Invalid Figma token or no access to file');
      }
      throw new Error(`Failed to get frame image: ${error.message}`);
    }
  }

  // Store current file key for image generation
  private currentFileKey?: string;

  /**
   * Set the current file key for operations
   */
  setCurrentFileKey(fileKey: string) {
    this.currentFileKey = fileKey;
  }

  /**
   * Analyze prototype file using different approach
   */
  async analyzePrototypeFile(fileKey: string, startNodeId: string, progressCallback?: (message: string) => void): Promise<FigmaPrototypeFlow> {
    try {
      progressCallback?.('Fetching prototype file structure...');
      
      // First, try to get the file with minimal data
      let fileData: any;
      try {
        fileData = await this.getFile(fileKey, { geometry: 'paths', depth: 2 });
        progressCallback?.(`✓ Accessed file: ${fileData.name}`);
      } catch (error: any) {
        console.error('File fetch error:', error.message);
        // If file is too large or inaccessible, create mock structure
        progressCallback?.('⚠️  Cannot access full file - will use image export to discover frames');
        
        // Try alternative approach: Export all pages as images
        return this.discoverPrototypeFramesViaExport(fileKey, startNodeId, progressCallback);
      }

      // For prototypes, we want to follow the flow, not get all frames
      progressCallback?.('Following prototype flow from starting point...');
      
      // Use the same flow discovery logic
      return this.discoverPrototypeFramesViaExport(fileKey, startNodeId, progressCallback);
    } catch (error: any) {
      progressCallback?.(`Error: ${error.message}`);
      throw error;
    }
  }


  /**
   * Discover prototype frames using export approach
   */
  private async discoverPrototypeFramesViaExport(fileKey: string, startNodeId: string, progressCallback?: (message: string) => void): Promise<FigmaPrototypeFlow> {
    progressCallback?.('Discovering prototype flow (only connected frames)...');
    
    const validFrames: PrototypeScreen[] = [];
    const navigation: NavigationLink[] = [];
    const visited = new Set<string>();
    const toCheck = [startNodeId];
    
    progressCallback?.(`Starting from frame: ${startNodeId}`);
    
    // Only follow prototype connections, don't scan everything
    while (toCheck.length > 0 && validFrames.length < 50) { // Limit to 50 frames max
      const currentFrameId = toCheck.shift()!;
      
      if (visited.has(currentFrameId)) continue;
      visited.add(currentFrameId);
      
      try {
        // First, try to get node data to find connections
        const nodeResponse = await this.client.get(`/files/${fileKey}/nodes?ids=${currentFrameId}`);
        
        if (nodeResponse.data.nodes && nodeResponse.data.nodes[currentFrameId]) {
          const node = nodeResponse.data.nodes[currentFrameId];
          const nodeName = node.document?.name || node.name || `Frame ${currentFrameId}`;
          
          progressCallback?.(`✓ Found prototype frame: ${nodeName}`);
          
          validFrames.push({
            id: currentFrameId,
            name: nodeName,
            frameId: currentFrameId,
            components: [],
            navigatesTo: []
          });
          
          // Look for prototype connections in the node
          const connections = this.findPrototypeConnections(node);
          connections.forEach(targetId => {
            if (!visited.has(targetId)) {
              toCheck.push(targetId);
              navigation.push({
                from: currentFrameId,
                to: targetId,
                trigger: 'click'
              });
              validFrames[validFrames.length - 1].navigatesTo.push(targetId);
            }
          });
        }
      } catch (error: any) {
        // If node fetch fails, try image check as fallback
        try {
          const imageUrl = await this.client.get(`/images/${fileKey}?ids=${currentFrameId}&format=png&scale=1`);
          
          if (imageUrl.data.images && imageUrl.data.images[currentFrameId]) {
            progressCallback?.(`✓ Found frame via image: ${currentFrameId}`);
            
            validFrames.push({
              id: currentFrameId,
              name: `Frame ${currentFrameId}`,
              frameId: currentFrameId,
              components: [],
              navigatesTo: []
            });
          }
        } catch (imgError) {
          // Frame not accessible, skip
        }
      }
    }

    if (validFrames.length === 0) {
      // Fallback to at least the starting frame
      validFrames.push({
        id: startNodeId,
        name: `Starting Frame`,
        frameId: startNodeId,
        components: [],
        navigatesTo: []
      });
    }

    progressCallback?.(`Found ${validFrames.length} frames with ${navigation.length} connections`);
    
    // Log the user flow for clarity
    if (navigation.length > 0) {
      progressCallback?.('\n🔄 User Flow Discovered:');
      navigation.forEach(nav => {
        const fromFrame = validFrames.find(f => f.id === nav.from);
        const toFrame = validFrames.find(f => f.id === nav.to);
        progressCallback?.(`   ${fromFrame?.name || nav.from} → ${toFrame?.name || nav.to}`);
      });
    }

    return {
      fileKey,
      fileName: 'Prototype Flow',
      screens: validFrames,
      navigation: navigation,
      components: [],
      totalScreens: validFrames.length,
      totalComponents: 0
    };
  }

  /**
   * Find prototype connections in a node
   */
  private findPrototypeConnections(node: any): string[] {
    const connections: string[] = [];
    
    // Check node document for transitions
    if (node.document) {
      if (node.document.transitionNodeID) {
        connections.push(node.document.transitionNodeID);
      }
      
      // Check for interactions
      if (node.document.interactions) {
        node.document.interactions.forEach((interaction: any) => {
          if (interaction.actions) {
            interaction.actions.forEach((action: any) => {
              if (action.destinationId && action.navigation === 'NAVIGATE') {
                connections.push(action.destinationId);
              }
            });
          }
        });
      }
      
      // Recursively check children
      if (node.document.children) {
        this.findConnectionsInChildren(node.document.children, connections);
      }
    }
    
    return [...new Set(connections)]; // Remove duplicates
  }

  /**
   * Recursively find connections in children
   */
  private findConnectionsInChildren(children: any[], connections: string[]) {
    children.forEach(child => {
      if (child.transitionNodeID) {
        connections.push(child.transitionNodeID);
      }
      
      if (child.interactions) {
        child.interactions.forEach((interaction: any) => {
          if (interaction.actions) {
            interaction.actions.forEach((action: any) => {
              if (action.destinationId && action.navigation === 'NAVIGATE') {
                connections.push(action.destinationId);
              }
            });
          }
        });
      }
      
      if (child.children) {
        this.findConnectionsInChildren(child.children, connections);
      }
    });
  }

  /**
   * Extract component structure and variables from file
   * Lightweight approach that only gets component names and variables
   */
  async extractComponentsFromFrame(
    fileKey: string, 
    nodeId: string,
    progressCallback?: (message: string) => void
  ): Promise<ComponentMap> {
    progressCallback?.('📐 Getting component structure and variables...');
    
    const componentMap: ComponentMap = {
      designTokens: {
        colors: {},
        typography: {},
        spacing: {}
      },
      atomicComponents: [],
      molecules: [],
      organisms: [],
      templates: [],
      componentSets: {},
      translations: {
        extracted: {},
        keyMapping: {},
        languages: {
          en: {}
        }
      }
    };
    
    try {
      // Step 1: Get file variables (colors, typography, spacing)
      progressCallback?.('🎨 Fetching design variables...');
      const variablesResponse = await this.getFileVariables(fileKey, progressCallback);
      componentMap.designTokens = variablesResponse;
      
      // Step 2: Get component library structure
      progressCallback?.('🧩 Mapping component library...');
      const componentMapping = await this.getComponentMapping(fileKey, nodeId, progressCallback);
      
      // Assign components to categories
      componentMap.atomicComponents = componentMapping.atoms;
      componentMap.molecules = componentMapping.molecules;
      componentMap.organisms = componentMapping.organisms;
      componentMap.templates = componentMapping.templates;
      componentMap.componentSets = componentMapping.sets;
      
      // Step 3: Get frame structure for context (shallow, no deep traversal)
      progressCallback?.('📄 Getting frame context...');
      try {
        const frameData = await this.client.get(`/files/${fileKey}/nodes?ids=${nodeId}&depth=2`);
        if (frameData.data.nodes?.[nodeId]) {
          const frameNode = frameData.data.nodes[nodeId];
          const frameName = frameNode.document?.name || frameNode.name || 'Frame';
          progressCallback?.(`✅ Frame context: ${frameName}`);
        }
      } catch (err) {
        progressCallback?.('⚠️  Could not get frame context');
      }
      
      const totalComponents = 
        componentMap.atomicComponents.length + 
        componentMap.molecules.length + 
        componentMap.organisms.length + 
        componentMap.templates.length;
      
      progressCallback?.(`✅ Mapped ${totalComponents} components with ${Object.keys(componentMap.designTokens.colors).length} design tokens`);
      
    } catch (error: any) {
      progressCallback?.(`❌ Error: ${error.message}`);
      throw error;
    }
    
    return componentMap;
  }
  /**
   * Extract components from entire file (lightweight version)
   */
  async extractComponentsFromFile(
    fileKey: string,
    progressCallback?: (message: string) => void
  ): Promise<ComponentMap> {
    progressCallback?.('📐 Getting design system from file...');
    
    const componentMap: ComponentMap = {
      designTokens: {
        colors: {},
        typography: {},
        spacing: {}
      },
      atomicComponents: [],
      molecules: [],
      organisms: [],
      templates: [],
      componentSets: {},
      translations: {
        extracted: {},
        keyMapping: {},
        languages: {
          en: {}
        }
      }
    };
    
    try {
      // Step 1: Get file variables (colors, typography, spacing)
      progressCallback?.('🎨 Fetching design variables...');
      const variablesResponse = await this.getFileVariables(fileKey, progressCallback);
      componentMap.designTokens = variablesResponse;
      
      // Step 2: Get component library structure for entire file
      progressCallback?.('🧩 Mapping component library...');
      const componentMapping = await this.getComponentMapping(fileKey, '', progressCallback);
      
      // Assign components to categories
      componentMap.atomicComponents = componentMapping.atoms;
      componentMap.molecules = componentMapping.molecules;
      componentMap.organisms = componentMapping.organisms;
      componentMap.templates = componentMapping.templates;
      componentMap.componentSets = componentMapping.sets;
      
      const totalComponents = 
        componentMap.atomicComponents.length + 
        componentMap.molecules.length + 
        componentMap.organisms.length + 
        componentMap.templates.length;
      
      progressCallback?.(`✅ Extracted ${totalComponents} components with ${Object.keys(componentMap.designTokens.colors).length} design tokens`);
      
    } catch (error: any) {
      progressCallback?.(`❌ Error: ${error.message}`);
      throw error;
    }
    
    return componentMap;
  }
  
  private rgbToHex(color: { r: number; g: number; b: number }): string {
    const toHex = (n: number) => {
      const hex = Math.round(n * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
  }
  
  /**
   * Get file variables (design tokens) efficiently
   */
  private async getFileVariables(fileKey: string, progressCallback?: (message: string) => void): Promise<ComponentMap['designTokens']> {
    const tokens: ComponentMap['designTokens'] = {
      colors: {},
      typography: {},
      spacing: {}
    };
    
    try {
      // Try to get variables if available
      const variablesResponse = await this.client.get(`/files/${fileKey}/variables/local`);
      
      if (variablesResponse.data?.meta?.variables) {
        Object.entries(variablesResponse.data.meta.variables).forEach(([id, variable]: [string, any]) => {
          if (variable.resolvedType === 'COLOR') {
            tokens.colors[variable.name] = this.rgbToHex(variable.valuesByMode?.default?.color || { r: 0, g: 0, b: 0 });
          } else if (variable.resolvedType === 'FLOAT') {
            tokens.spacing[variable.name] = variable.valuesByMode?.default;
          }
        });
      }
    } catch (error) {
      // Variables API might not be available, fallback to styles
      try {
        const stylesResponse = await this.client.get(`/files/${fileKey}/styles`);
        
        if (stylesResponse.data?.meta?.styles) {
          stylesResponse.data.meta.styles.forEach((style: any) => {
            if (style.style_type === 'FILL' && style.name) {
              tokens.colors[style.name] = '#000000'; // Placeholder
            } else if (style.style_type === 'TEXT' && style.name) {
              tokens.typography[style.name] = {
                fontFamily: 'Inter',
                fontSize: 16,
                fontWeight: 400,
                lineHeight: 24,
                letterSpacing: 0
              };
            }
          });
        }
      } catch (styleError) {
        // Silently continue with empty tokens
      }
    }
    
    return tokens;
  }
  
  /**
   * Get lightweight component mapping without deep traversal
   */
  private async getComponentMapping(fileKey: string, startNodeId: string, progressCallback?: (message: string) => void) {
    const mapping = {
      atoms: [] as ComponentInfo[],
      molecules: [] as ComponentInfo[],
      organisms: [] as ComponentInfo[],
      templates: [] as ComponentInfo[],
      sets: {} as Record<string, ComponentInfo[]>
    };
    
    try {
      // First try components API (requires library_content:read scope)
      try {
        const componentsResponse = await this.client.get(`/files/${fileKey}/components`);
        
        if (componentsResponse.data?.meta?.components) {
          const componentList = componentsResponse.data.meta.components;
          progressCallback?.(`Found ${componentList.length} components via API`);
          
          // Create lightweight component info for each
          componentList.forEach((comp: any) => {
            const componentInfo: ComponentInfo = {
              id: comp.node_id,
              name: comp.name,
              type: 'COMPONENT',
              parentScreen: startNodeId,
              properties: {
                description: comp.description || ''
              },
              instances: 1
            };
            
            // Simple categorization based on name
            if (this.isAtomicComponent(componentInfo)) {
              mapping.atoms.push(componentInfo);
            } else if (this.isMolecule(componentInfo)) {
              mapping.molecules.push(componentInfo);
            } else if (this.isOrganism(componentInfo)) {
              mapping.organisms.push(componentInfo);
            } else {
              mapping.templates.push(componentInfo);
            }
            
            // Group by containing frame/set
            if (comp.containing_frame?.name) {
              const setName = comp.containing_frame.name;
              if (!mapping.sets[setName]) {
                mapping.sets[setName] = [];
              }
              mapping.sets[setName].push(componentInfo);
            }
          });
          
          return mapping;
        }
      } catch (apiError: any) {
        // If components API fails (likely due to scope), fall back to file scanning
        progressCallback?.('Components API unavailable, scanning file structure...');
      }
      
      // Fallback: Scan file structure for components and instances
      progressCallback?.('Scanning file for components and instances...');
      const fileResponse = await this.client.get(`/files/${fileKey}`, {
        params: {
          depth: 3,
          geometry: 'paths'
        }
      });
      
      const componentMap = new Map<string, ComponentInfo>();
      const instanceCounts = new Map<string, number>();
      
      // Recursive function to find components and instances
      const scanNode = (node: any, pageName: string = '') => {
        if (node.type === 'COMPONENT') {
          const componentInfo: ComponentInfo = {
            id: node.id,
            name: node.name,
            type: 'COMPONENT',
            parentScreen: pageName,
            properties: {
              description: node.description || ''
            },
            instances: 0,
            isReusable: true
          };
          
          componentMap.set(node.id, componentInfo);
          
          // Categorize component
          if (this.isAtomicComponent(componentInfo)) {
            mapping.atoms.push(componentInfo);
          } else if (this.isMolecule(componentInfo)) {
            mapping.molecules.push(componentInfo);
          } else if (this.isOrganism(componentInfo)) {
            mapping.organisms.push(componentInfo);
          } else {
            mapping.templates.push(componentInfo);
          }
        } else if (node.type === 'INSTANCE' && node.componentId) {
          // Count instances
          instanceCounts.set(node.componentId, (instanceCounts.get(node.componentId) || 0) + 1);
        }
        
        // Recursively scan children
        if (node.children) {
          node.children.forEach((child: any) => scanNode(child, pageName));
        }
      };
      
      // Scan all pages
      if (fileResponse.data.document?.children) {
        fileResponse.data.document.children.forEach((page: any) => {
          if (page.children) {
            page.children.forEach((child: any) => scanNode(child, page.name));
          }
        });
      }
      
      // Update instance counts
      instanceCounts.forEach((count, componentId) => {
        const component = componentMap.get(componentId);
        if (component) {
          component.instances = count;
        }
      });
      
      progressCallback?.(`Found ${componentMap.size} components and ${instanceCounts.size} component usages`);
      
    } catch (error: any) {
      progressCallback?.(`Component scan error: ${error.message}`);
      // Return minimal mapping on error
      const simpleInfo: ComponentInfo = {
        id: startNodeId || 'main',
        name: 'Main Frame',
        type: 'FRAME',
        parentScreen: startNodeId || 'main',
        properties: {},
        instances: 1
      };
      mapping.templates.push(simpleInfo);
    }
    
    return mapping;
  }
  
  private isAtomicComponent(component: ComponentInfo): boolean {
    const atomicPatterns = /^(button|icon|input|label|badge|avatar|checkbox|radio|toggle|chip)$/i;
    return atomicPatterns.test(component.name) || (component.children?.length || 0) <= 2;
  }
  
  private isMolecule(component: ComponentInfo): boolean {
    const moleculePatterns = /^(card|form-field|search-bar|navigation-item|list-item|dropdown|tooltip)$/i;
    return moleculePatterns.test(component.name) || 
           ((component.children?.length || 0) > 2 && (component.children?.length || 0) <= 5);
  }
  
  private isOrganism(component: ComponentInfo): boolean {
    const organismPatterns = /^(header|footer|sidebar|navigation|form|section|hero|feature)$/i;
    return organismPatterns.test(component.name) || (component.children?.length || 0) > 5;
  }
  
  private isTemplate(component: ComponentInfo): boolean {
    const templatePatterns = /^(page|layout|template|view|screen)$/i;
    return templatePatterns.test(component.name) || component.type === 'FRAME';
  }
  
  private detectReusablePatterns(components: ComponentInfo[], componentMap: ComponentMap) {
    // Group components by similar properties
    const propertyGroups = new Map<string, ComponentInfo[]>();
    
    components.forEach(component => {
      if (component.properties) {
        const propKey = JSON.stringify({
          fills: component.properties.fills,
          cornerRadius: component.properties.cornerRadius,
          layoutMode: component.properties.layoutMode
        });
        
        if (!propertyGroups.has(propKey)) {
          propertyGroups.set(propKey, []);
        }
        propertyGroups.get(propKey)!.push(component);
      }
    });
    
    // Mark components that appear multiple times with similar properties as reusable
    propertyGroups.forEach(group => {
      if (group.length > 1) {
        group.forEach(component => {
          component.isReusable = true;
          component.variants = group.map(c => c.name);
        });
      }
    });
  }

  /**
   * Download frame images from Figma
   */
  async downloadFrameImages(
    screens: PrototypeScreen[],
    fileKey: string,
    outputDir: string,
    progressCallback?: (message: string) => void
  ): Promise<string[]> {
    const downloadedFiles: string[] = [];
    const batchSize = 5; // Process 5 frames at a time to avoid rate limiting
    
    // Modules are imported at the top of the file
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    for (let i = 0; i < screens.length; i += batchSize) {
      const batch = screens.slice(i, i + batchSize);
      const nodeIds = batch.map(s => s.frameId || s.id).join(',');
      
      progressCallback?.(`📥 Downloading frames ${i + 1}-${Math.min(i + batchSize, screens.length)} of ${screens.length}...`);
      
      try {
        // Get image URLs from Figma
        const response = await this.client.get(`/images/${fileKey}`, {
          params: {
            ids: nodeIds,
            format: 'png',
            scale: 2 // 2x for retina displays
          }
        });
        
        // Download each image
        for (let j = 0; j < batch.length; j++) {
          const screen = batch[j];
          const imageUrl = response.data.images[screen.frameId || screen.id];
          
          if (imageUrl) {
            const filename = `${String(i + j + 1).padStart(2, '0')}-${screen.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`;
            const filePath = path.join(outputDir, filename);
            
            // Download the image
            await new Promise((resolve, reject) => {
              const file = fs.createWriteStream(filePath);
              https.get(imageUrl, (response: any) => {
                response.pipe(file);
                file.on('finish', () => {
                  file.close();
                  downloadedFiles.push(filename);
                  resolve(null);
                });
              }).on('error', (err: any) => {
                fs.unlink(filePath, () => {}); // Delete the file on error
                reject(err);
              });
            });
          }
        }
        
        // Add delay between batches to avoid rate limiting
        if (i + batchSize < screens.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error: any) {
        progressCallback?.(`⚠️  Error downloading batch: ${error.message}`);
      }
    }
    
    progressCallback?.(`✅ Downloaded ${downloadedFiles.length} frame images`);
    return downloadedFiles;
  }
  
}

export interface ImplementationPlan {
  tasks: ImplementationTask[];
  summary: {
    totalScreens: number;
    totalComponents: number;
    totalTasks: number;
    estimatedHours: number;
  };
}

export interface ImplementationTask {
  id: string;
  title: string;
  frameId: string;
  description: string;
  subtasks: Subtask[];
  priority: 'high' | 'medium' | 'low';
  components: number;
}

interface Subtask {
  id: string;
  title: string;
  type: string;
}