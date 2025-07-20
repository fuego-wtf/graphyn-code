import React, { useEffect, useState } from 'react';
import { Box, Text, useApp } from 'ink';
import Spinner from 'ink-spinner';
import { execSync } from 'child_process';
import { FigmaAPIClient } from '../../figma-api.js';
import { GraphynLogger } from '../../logger.js';
import { useClaude } from '../hooks/useClaude.js';
import { useAPI } from '../hooks/useAPI.js';
import { ConfigManager } from '../../config-manager.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getAccentColor, getDimColor } from '../theme/colors.js';

interface FigmaDesignProps {
  url: string;
  framework?: string;
}

type DesignStep = 
  | 'checking-auth'
  | 'authenticating'
  | 'analyzing'
  | 'generating-plan'
  | 'preparing-context'
  | 'launching'
  | 'error';

export const FigmaDesign: React.FC<FigmaDesignProps> = ({ url, framework = 'react' }) => {
  // Check if user wants component extraction
  const cleanUrl = url.replace('--extract-components', '').trim();
  const isComponentExtraction = url.includes('--extract-components');
  const { exit } = useApp();
  const { client: apiClient } = useAPI();
  const { launchClaude } = useClaude();
  
  const [step, setStep] = useState<DesignStep>('checking-auth');
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Checking Figma authentication...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [authInstructions, setAuthInstructions] = useState(false);
  const [prototype, setPrototype] = useState<any>(null);

  useEffect(() => {
    handleDesignFlow();
  }, [url]);

  const handleDesignFlow = async () => {
    try {
      // Step 1: Check Figma OAuth authentication
      setStep('checking-auth');
      setProgress(10);
      
      const config = new ConfigManager();
      let token: string;
      
      // Use OAuth authentication
      const tokens = await config.get('figma.oauth') as any;
      
      if (!tokens || !tokens.access_token || tokens.expires_at < Date.now()) {
        setStep('error');
        setErrorMessage('Figma authentication required');
        setAuthInstructions(true);
        return;
      }
      
      token = tokens.access_token;
      
      setProgress(20);
      setStatusMessage('✓ Figma authenticated');
      
      // Step 2: Initialize Figma API client
      setStep('analyzing');
      setProgress(30);
      setStatusMessage('Connecting to Figma...');
      
      const figmaClient = new FigmaAPIClient(token);
      
      // Parse URL and set file key
      const urlParts = figmaClient.parseUrl(cleanUrl);
      figmaClient.setCurrentFileKey(urlParts.fileKey);
      
      // Step 3: Analyze prototype or extract components
      setProgress(40);
      
      let prototypeData;
      let componentMap;
      
      if (isComponentExtraction) {
        // Extract components from entire file (lightweight)
        setStatusMessage('Extracting design system from file...');
        
        try {
          // Get file-level component data
          const componentMap = await figmaClient.extractComponentsFromFile(
            urlParts.fileKey,
            (message: string) => setStatusMessage(message)
          );
          
          // Still analyze prototype for navigation flow
          setStatusMessage('Analyzing prototype navigation...');
          prototypeData = await figmaClient.analyzePrototype(cleanUrl, (message: string) => {
            setStatusMessage(message);
          });
          
          // Update prototype data with component information
          prototypeData.components = [
            ...componentMap.atomicComponents,
            ...componentMap.molecules,
            ...componentMap.organisms,
            ...componentMap.templates
          ];
          prototypeData.componentMap = componentMap;
          prototypeData.totalComponents = prototypeData.components.length;
          
          // componentMap already set
        } catch (error: any) {
          throw new Error(`Component extraction failed: ${error.message}`);
        }
      } else {
        // Normal prototype analysis
        setStatusMessage('Analyzing Figma prototype...');
        
        try {
          prototypeData = await figmaClient.analyzePrototype(cleanUrl, (message: string) => {
            setStatusMessage(message);
          });
        } catch (error: any) {
          // If specific node fails, try alternative approach
          if (error.message.includes('not found') || error.message.includes('404')) {
            setStatusMessage('Trying alternative approach...');
          
          try {
            const fileData = await figmaClient.getFile(urlParts.fileKey, { geometry: 'paths', depth: 1 });
            
            // Create minimal prototype structure
            prototypeData = {
              fileKey: urlParts.fileKey,
              fileName: fileData.name,
              screens: [],
              navigation: [],
              components: [],
              totalScreens: 0,
              totalComponents: 0
            };
            
            setStatusMessage('⚠  Limited access - using basic file info');
          } catch (fileError: any) {
            throw new Error(`Cannot access Figma file: ${fileError.message}`);
          }
          } else {
            throw error;
          }
        }
      }
      
      setPrototype(prototypeData);
      
      // Step 4: Generate implementation plan
      setStep('generating-plan');
      setProgress(60);
      setStatusMessage('Building implementation plan...');
      
      const plan = figmaClient.generateImplementationPlan(prototypeData);
      
      // Step 5: Extract design data (if API available)
      if (apiClient) {
        setProgress(70);
        setStatusMessage('Extracting design data...');
        
        try {
          const extractionResponse = await apiClient.post('/api/design/extract', {
            figmaUrl: url,
            figmaToken: token,
            framework
          });
          
          if ((extractionResponse as any).data) {
            prototypeData.extractedData = (extractionResponse as any).data;
          }
        } catch (error) {
          // Non-critical error - continue without extraction
        }
      }
      
      setProgress(80);
      setStatusMessage(`Found ${prototypeData.totalScreens} screens with ${prototypeData.totalComponents} components!`);
      
      // Step 6: Extract design assets
      if (isComponentExtraction || prototypeData.totalScreens > 0) {
        setStep('analyzing');
        setProgress(82);
        setStatusMessage('▼ Downloading design assets...');
        
        try {
          // Create design folder structure
          const designPath = path.join(process.cwd(), 'design');
          const folders = ['frames', 'icons', 'illustrations', 'assets', 'mapping'];
          
          for (const folder of folders) {
            const folderPath = path.join(designPath, folder);
            if (!fs.existsSync(folderPath)) {
              fs.mkdirSync(folderPath, { recursive: true });
            }
          }
          
          // Download frame images
          setStatusMessage(`▼ Downloading ${prototypeData.totalScreens} frame images...`);
          const frameImages = await figmaClient.downloadFrameImages(
            prototypeData.screens,
            urlParts.fileKey,
            path.join(designPath, 'frames'),
            (progress: string) => setStatusMessage(progress)
          );
          
          setProgress(85);
          setStatusMessage(`✓ Downloaded ${frameImages.length} frame images to /design/frames/`);
          
          // Save frame mapping
          const frameMapping = {
            frames: prototypeData.screens.map((screen: any, index: number) => ({
              id: screen.id,
              name: screen.name,
              filename: `${String(index + 1).padStart(2, '0')}-${screen.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`,
              frameId: screen.frameId
            })),
            totalFrames: prototypeData.totalScreens,
            generatedAt: new Date().toISOString()
          };
          
          fs.writeFileSync(
            path.join(designPath, 'mapping', 'frame-index.json'),
            JSON.stringify(frameMapping, null, 2)
          );
          
          setStatusMessage('✓ Assets downloaded successfully!');
        } catch (error: any) {
          console.error('Asset download error:', error);
          setStatusMessage(`⚠  Asset download skipped: ${error.message}`);
        }
      }
      
      // Step 7: Generate context for Claude
      setStep('preparing-context');
      setProgress(90);
      setStatusMessage('Preparing design context...');
      
      const context = isComponentExtraction && componentMap
        ? generateComponentMapContext(cleanUrl, prototypeData, componentMap, framework)
        : generateDesignContext(cleanUrl, prototypeData, plan, framework);
      
      // Log interaction
      const logger = new GraphynLogger();
      const contextPath = await saveContext(context, 'design');
      
      logger.logInteraction({
        agent: 'design',
        query: url,
        contextFile: contextPath,
        mode: 'cli'
      });
      
      // Step 7: Launch Claude Code
      setStep('launching');
      setProgress(95);
      setStatusMessage('Launching Claude Code with Figma context...');
      
      const result = await launchClaude({
        content: context,
        agent: 'design',
        projectContext: '',
        saveToHistory: true
      });
      
      setProgress(100);
      
      if (result.success) {
        setStatusMessage('✓ Claude Code launched with Figma context!');
        
        // Exit after brief delay
        setTimeout(() => {
          exit();
        }, 1000);
      } else {
        throw new Error(result.error || 'Failed to launch Claude');
      }
      
    } catch (error: any) {
      setStep('error');
      setErrorMessage(error.message);
      
      // Exit after showing error
      setTimeout(() => {
        exit();
      }, 5000);
    }
  };

  const getStepIcon = () => {
    switch (step) {
      case 'checking-auth':
      case 'authenticating':
      case 'analyzing':
      case 'generating-plan':
      case 'preparing-context':
      case 'launching':
        return <Spinner type="dots" />;
      case 'error':
        return '✗';
      default:
        return null;
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="magenta">
        ■ Figma Design Import
      </Text>
      
      <Box marginTop={1}>
        <Text color={getDimColor()}>URL: {url}</Text>
      </Box>
      
      <Box marginTop={2}>
        <Text>
          {getStepIcon()} {statusMessage}
        </Text>
      </Box>
      
      <Box marginTop={1}>
        <Text color="blue">
          [{'█'.repeat(Math.floor(progress / 10)).padEnd(10, '░')}] {progress}%
        </Text>
      </Box>
      
      {step === 'error' && errorMessage && (
        <Box marginTop={2} flexDirection="column">
          <Text color="red">✗ {errorMessage}</Text>
          
          {authInstructions && (
            <Box marginTop={1} flexDirection="column">
              <Text color="blue">To access Figma files, you need to authenticate:</Text>
              <Text color="magenta">1. Exit this tool (press Ctrl+C)</Text>
              <Text color="magenta">2. Run: graphyn design auth</Text>
              <Text color="magenta">3. Complete OAuth in your browser</Text>
              <Text color="magenta">4. Try again: graphyn design {url}</Text>
            </Box>
          )}
        </Box>
      )}
      
      {prototype && (
        <Box marginTop={2} flexDirection="column" borderStyle="single" padding={1}>
          <Text bold color="cyan">□ Prototype Analysis</Text>
          <Text>File: {prototype.fileName}</Text>
          <Text>Screens: {prototype.totalScreens}</Text>
          <Text>Components: {prototype.totalComponents}</Text>
          <Text>Framework: {framework}</Text>
        </Box>
      )}
    </Box>
  );
};

function generateDesignContext(url: string, prototype: any, plan: any, framework: string): string {
  const timestamp = new Date().toISOString();
  
  // Use a comprehensive fallback prompt since we can't reliably load from file in ESM
  const designPrompt = `# Design Agent

You are a design implementation specialist who transforms Figma prototypes into pixel-perfect code implementations.

## Your Expertise:
- Converting Figma designs to production-ready React/Vue/Angular components
- Implementing responsive layouts that match design specifications exactly
- Creating reusable component libraries from design systems
- Ensuring accessibility while maintaining visual fidelity

## Your Process:
1. Analyze the Figma prototype structure and user flows
2. Identify reusable components and patterns
3. Plan the implementation architecture
4. Build components with proper styling and interactions
5. Test against the original designs for accuracy

## Key Principles:
- Pixel-perfect implementation is the goal
- Component reusability and maintainability
- Responsive design that works across devices
- Clean, semantic HTML structure
- Modern CSS techniques for layouts
- Proper state management for interactions`;
  
  return `# Design Agent Context

${designPrompt}

---

# Figma Implementation Plan

Generated by Graphyn Code at ${timestamp}

## Prototype Overview

- **Figma URL**: ${url}
- **File Name**: ${prototype.fileName}
- **Total Screens**: ${prototype.totalScreens}
- **Total Components**: ${prototype.totalComponents}
- **Framework**: ${framework}
- **Estimated Time**: ${plan.summary.estimatedHours} hours

## Prototype Interactions

${prototype.screens && prototype.screens.length > 0 ? `
### Screen Flow
${prototype.screens.map((screen: any, index: number) => 
  `${index + 1}. **${screen.name}** (${screen.id})${
    screen.navigatesTo.length > 0 
      ? `\n   → Navigates to: ${screen.navigatesTo.join(', ')}`
      : ''
  }`
).join('\n')}

### Navigation Details
${prototype.navigation && prototype.navigation.length > 0 
  ? prototype.navigation.map((nav: any) => 
      `- From **${nav.from}** to **${nav.to}**
  - Trigger: ${nav.trigger}
  - Action: ${nav.action || 'NAVIGATE'}${
    nav.transition ? `\n  - Transition: ${nav.transition}` : ''
  }${
    nav.duration ? `\n  - Duration: ${nav.duration}ms` : ''
  }`
    ).join('\n\n')
  : 'No navigation links found'}
` : 'No screens detected'}

## Implementation Tasks

${plan.tasks.map((task: any, index: number) => `
### ${index + 1}. ${task.title}
- **Priority**: ${task.priority}
- **Frame ID**: ${task.frameId || 'N/A'}
${task.components > 0 ? `- **Components**: ${task.components}` : ''}
${task.description ? `- **Description**: ${task.description}` : ''}

${task.subtasks.length > 0 ? `**Subtasks**:
${task.subtasks.map((st: any) => `- ${st.title}`).join('\n')}` : ''}
`).join('\n')}

## 🚀 FIRST STEP: Create Comprehensive Task List

### Use TodoWrite to persist ALL implementation tasks:
\`\`\`javascript
// Copy this ENTIRE task list and use with TodoWrite tool
const allTasks = [
  // Phase 1: Asset Preparation (MUST DO FIRST!)
  { id: "asset-1", content: "Create /design folder structure", priority: "high", status: "pending" },
  { id: "asset-2", content: "Run npm run extract:figma to download all frames", priority: "high", status: "pending" },
  { id: "asset-3", content: "Verify all ${prototype.totalScreens} frame PNGs downloaded", priority: "high", status: "pending" },
  { id: "asset-4", content: "Extract SVG icons using Figma export API", priority: "high", status: "pending" },
  { id: "asset-5", content: "Extract SVG illustrations and graphics", priority: "high", status: "pending" },
  { id: "asset-6", content: "Create component-to-frame mapping JSON", priority: "high", status: "pending" },
  
  // ... (include ALL tasks from comprehensive plan)
  
  // IMPORTANT: Start with asset-1 and asset-2 immediately!
];

// First command to run:
TodoWrite(allTasks);
\`\`\`

### ⚠️ CRITICAL: Design Folder Setup
The /design folder must be populated BEFORE implementation:
1. Run \`npm run extract:figma\` if available
2. OR manually export from Figma:
   - All ${prototype.totalScreens} screens as PNG @ 2x
   - All icons as SVG
   - All illustrations as SVG

## Asset Extraction Phase

### 1. Create Design Folder Structure
\`\`\`
/design/
├── frames/          # Screen images (PNG)
├── components/      # Component images for reference
├── icons/          # SVG icons extracted from Figma
├── illustrations/  # SVG illustrations
├── assets/         # Other visual assets
└── mapping/        # JSON files for relationships
\`\`\`

### 2. Download ALL Visual Assets
- Frame images (PNG) for all ${prototype.totalScreens} screens
- SVG exports for all icons
- SVG exports for illustrations/graphics
- Component images for visual reference
- **NO copy-pasting or recreating** - everything downloaded directly

### 3. Asset Download Script
Use the provided script: \`npm run extract:figma\` (if available)

## Critical Implementation Rules

### ⚠️ PRESERVE ALL EXISTING LOGIC
- **DO NOT** modify business logic
- **DO NOT** change API integration  
- **DO NOT** alter authentication flows
- **DO NOT** modify state management
- **ONLY** update the visual layer

### Authentication Pages Special Note
For sign-up/sign-in pages:
- Keep all validation logic intact
- Preserve form submission handlers
- Maintain error handling
- Keep redirect logic
- Only update UI components and styling

## Implementation Sequence

### Phase 1: Asset Preparation
1. Download all frame images first
2. Extract SVG icons and illustrations
3. Create component mapping document
4. Validate all assets are downloaded

### Phase 2: Component Implementation
1. Use TodoWrite tool to create comprehensive task list:

\`\`\`javascript
// COMPREHENSIVE TASK LIST FOR TODOWRITE
const implementationTasks = [
  // Phase 1: Asset Preparation
  { id: "asset-1", content: "Create /design folder structure", priority: "high", status: "pending" },
  { id: "asset-2", content: "Download all ${prototype.totalScreens} frame images as PNGs", priority: "high", status: "pending" },
  { id: "asset-3", content: "Extract all SVG icons from Figma", priority: "high", status: "pending" },
  { id: "asset-4", content: "Extract all SVG illustrations and graphics", priority: "high", status: "pending" },
  { id: "asset-5", content: "Create frame-to-route mapping document", priority: "high", status: "pending" },
  
  // Phase 2: Design System Setup
  { id: "design-1", content: "Extract design variables using MCP tools", priority: "high", status: "pending" },
  { id: "design-2", content: "Create theme configuration from Figma tokens", priority: "high", status: "pending" },
  { id: "design-3", content: "Setup color palette matching Figma", priority: "high", status: "pending" },
  { id: "design-4", content: "Configure typography system", priority: "high", status: "pending" },
  { id: "design-5", content: "Setup spacing and layout system", priority: "high", status: "pending" },
  
  // Phase 3: Component Development
  { id: "comp-1", content: "Analyze existing components (preserve logic)", priority: "high", status: "pending" },
  { id: "comp-2", content: "Update Button component (visual only)", priority: "high", status: "pending" },
  { id: "comp-3", content: "Update Input component (preserve validation)", priority: "high", status: "pending" },
  { id: "comp-4", content: "Create/update Card components", priority: "medium", status: "pending" },
  { id: "comp-5", content: "Update Navigation components", priority: "medium", status: "pending" },
  { id: "comp-6", content: "Import and integrate all SVG icons", priority: "medium", status: "pending" },
  
  // Phase 4: Page Implementation
  { id: "page-1", content: "Update Landing Page (Frame 1568:55865)", priority: "high", status: "pending" },
  { id: "page-2", content: "Update Sign Up page (preserve auth logic)", priority: "high", status: "pending" },
  { id: "page-3", content: "Update Sign In page (preserve auth logic)", priority: "high", status: "pending" },
  { id: "page-4", content: "Update Thread View pages", priority: "high", status: "pending" },
  { id: "page-5", content: "Update Agent Creation flow", priority: "medium", status: "pending" },
  { id: "page-6", content: "Update Agency Creation flow", priority: "medium", status: "pending" },
  
  // Phase 5: Integration & Testing
  { id: "test-1", content: "Verify all auth flows work correctly", priority: "high", status: "pending" },
  { id: "test-2", content: "Test navigation between all screens", priority: "high", status: "pending" },
  { id: "test-3", content: "Validate against Figma frame images", priority: "high", status: "pending" },
  { id: "test-4", content: "Ensure no API calls broken", priority: "high", status: "pending" },
  { id: "test-5", content: "Performance and accessibility check", priority: "medium", status: "pending" }
];

// Use this with TodoWrite tool to persist all tasks
\`\`\`

2. Start implementation following task order
3. Mark tasks as "in_progress" when starting
4. Update to "completed" when done

### Phase 3: MCP Tool Usage Pattern
For **EACH** component:
\`\`\`bash
# 1. Get visual reference (for frames/screens)
mcp__figma-dev-mode-mcp-server__get_image --nodeId="[frame-id]"

# 2. Get component code (for individual components)
mcp__figma-dev-mode-mcp-server__get_code --nodeId="[component-id]"

# 3. Get design variables
mcp__figma-dev-mode-mcp-server__get_variable_defs --nodeId="[id]"
\`\`\`

### Phase 4: Validation
1. Test each component preserves functionality
2. Verify against frame images in /design/frames/
3. Ensure no console errors
4. Check all API calls still work

## Important Notes

- **Use downloaded SVGs** from /design folder - never recreate
- **Match pixel-perfectly** using frame images as reference
- **Import icons directly** - don't use icon fonts
- **Preserve all functionality** - visual updates only

Remember: The goal is pixel-perfect implementation matching the Figma designs while preserving 100% of existing functionality.`;
}

function generateComponentMapContext(url: string, prototype: any, componentMap: any, framework: string): string {
  const timestamp = new Date().toISOString();
  
  return `# Design System Component Extraction

Generated by Graphyn Code at ${timestamp}

## Frame Analysis

- **Figma URL**: ${url}
- **Total Components Extracted**: ${prototype.totalComponents}
- **Framework**: ${framework}

## Design Tokens

### Colors
${Object.entries(componentMap.designTokens.colors).map(([name, value]) => `- **${name}**: ${value}`).join('\n') || '- No colors found'}

### Typography
${Object.entries(componentMap.designTokens.typography).map(([key, value]: [string, any]) => 
  `- **${key}**: ${value.fontFamily} ${value.fontSize}px (weight: ${value.fontWeight})`
).join('\n') || '- No typography tokens found'}

### Spacing
${Object.entries(componentMap.designTokens.spacing).map(([key, value]) => `- **${key}**: ${value}px`).join('\n') || '- No spacing tokens found'}

## Component Architecture

### Atomic Components (${componentMap.atomicComponents.length})
${componentMap.atomicComponents.map((c: any) => `- **${c.name}** (${c.id})${c.isReusable ? ' 🔄 Reusable' : ''}`).join('\n') || 'None found'}

### Molecules (${componentMap.molecules.length})
${componentMap.molecules.map((c: any) => `- **${c.name}** (${c.id})${c.isReusable ? ' 🔄 Reusable' : ''}`).join('\n') || 'None found'}

### Organisms (${componentMap.organisms.length})
${componentMap.organisms.map((c: any) => `- **${c.name}** (${c.id})${c.isReusable ? ' 🔄 Reusable' : ''}`).join('\n') || 'None found'}

### Templates (${componentMap.templates.length})
${componentMap.templates.map((c: any) => `- **${c.name}** (${c.id})`).join('\n') || 'None found'}

## Component Sets & Variants
${Object.entries(componentMap.componentSets).map(([setId, components]: [string, any]) => `
### Component Set: ${setId}
${components.map((c: any) => `- ${c.name}`).join('\n')}
`).join('\n') || 'No component sets found'}

## Component Naming Patterns

### Inferred Component Structure
${(() => {
  const patterns = new Map();
  [...componentMap.atomicComponents, ...componentMap.molecules, ...componentMap.organisms].forEach(c => {
    const parts = c.name.split('/');
    if (parts.length > 1) {
      const base = parts[0];
      if (!patterns.has(base)) patterns.set(base, []);
      patterns.get(base).push(parts.slice(1).join('/'));
    }
  });
  
  return Array.from(patterns.entries()).map(([base, variants]) => 
    `- **${base}**: ${variants.join(', ')}`
  ).join('\n') || 'No clear patterns detected';
})()}

## Prototype Interactions & Navigation

${prototype.navigation && prototype.navigation.length > 0 ? `
### Navigation Flows
${prototype.navigation.map((nav: any) => 
  `- **${nav.from}** → **${nav.to}** (trigger: ${nav.trigger})`
).join('\n')}

### Screen Connections
${prototype.screens?.map((screen: any) => 
  screen.navigatesTo.length > 0 
    ? `- **${screen.name}** navigates to: ${screen.navigatesTo.join(', ')}`
    : ''
).filter(Boolean).join('\n') || 'No navigation found'}
` : 'No prototype interactions detected'}

## Implementation Plan

### 1. Setup Design System
- Create tokens file with extracted design tokens
- Configure component library for ${framework}
- Setup base component structure

### 2. Build Atomic Components
${componentMap.atomicComponents.slice(0, 5).map((c: any) => 
  `- Implement ${c.name}`
).join('\n') || '- No atomic components found'}

### 3. Compose Molecules
${componentMap.molecules.slice(0, 5).map((c: any) => 
  `- Build ${c.name} using atomic components`
).join('\n') || '- No molecules found'}

### 4. Assemble Organisms
${componentMap.organisms.slice(0, 5).map((c: any) => `- Create ${c.name} from molecules and atoms`).join('\n')}

### 5. Create Templates
${componentMap.templates.slice(0, 3).map((c: any) => `- Implement ${c.name} layout`).join('\n') || '- No templates found'}

## MCP Tool Usage

For each component, use the following workflow:
1. \`mcp__figma-dev-mode-mcp-server__get_image\` - Get visual reference
2. \`mcp__figma-dev-mode-mcp-server__get_code\` - Generate component code
3. \`mcp__figma-dev-mode-mcp-server__get_variable_defs\` - Get design variables

## Component Implementation Strategy

Based on the component names, implement with proper variant support:

\`\`\`${framework === 'react' ? 'jsx' : 'vue'}
${framework === 'react' ? `// Example for Button/Primary, Button/Secondary pattern
export const Button = ({ variant = 'primary', onClick, children }) => {
  const styles = {
    primary: 'bg-primary-500 text-white hover:bg-primary-600',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200'
  };
  
  return (
    <button 
      className={\`px-4 py-2 rounded-lg \${styles[variant]}\`}
      onClick={onClick}
    >
      {children}
    </button>
  );
};` : `<template>
  <button 
    :class="buttonClasses"
    @click="onClick"
  >
    <slot />
  </button>
</template>

<script>
export default {
  props: ['variant', 'onClick'],
  computed: {
    buttonClasses() {
      const styles = {
        primary: 'bg-primary-500 text-white hover:bg-primary-600',
        secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200'
      };
      return \`px-4 py-2 rounded-lg \${styles[this.variant || 'primary']}\`;
    }
  }
}
</script>`}
\`\`\`

## Reusable Patterns Detected
${componentMap.atomicComponents.filter((c: any) => c.instances && c.instances > 1).map((c: any) => 
  `- **${c.name}**: Used ${c.instances} times`
).join('\n') || 'Analyzing component usage patterns...'}

## Design System Summary

- **Total Design Tokens**: ${Object.keys(componentMap.designTokens.colors).length + Object.keys(componentMap.designTokens.typography).length + Object.keys(componentMap.designTokens.spacing).length}
- **Component Categories**: ${componentMap.atomicComponents.length} atoms, ${componentMap.molecules.length} molecules, ${componentMap.organisms.length} organisms
- **Component Sets**: ${Object.keys(componentMap.componentSets).length} variant groups

## Asset Extraction Requirements

### 1. Create Design Folder
\`\`\`
/design/
├── frames/          # All ${prototype.totalScreens} screen PNGs
├── icons/          # SVG icons from Figma
├── illustrations/  # SVG graphics
└── mapping/        # Component relationships
\`\`\`

### 2. Download Assets First
- Use Figma export API for SVGs
- Download all frame images at 2x resolution
- **NEVER recreate SVGs manually**
- **ALWAYS use original assets**

## Critical Rules for Implementation

### ⚠️ PRESERVE ALL LOGIC
- **DO NOT** modify any business logic
- **DO NOT** change state management
- **DO NOT** alter API calls
- **ONLY** update visual components

### For Authentication Components
- Keep validation rules intact
- Preserve error handling
- Maintain form submission logic
- Only update styling and layout

Use the component names to infer relationships and build a consistent component library while preserving all functionality.`;
}

async function saveContext(content: string, agentType: string): Promise<string> {
  const graphynDir = path.join(os.homedir(), '.graphyn');
  const contextsDir = path.join(graphynDir, 'contexts', agentType);
  
  // Create directories
  try {
    fs.mkdirSync(contextsDir, { recursive: true });
  } catch (e) {
    // Directory might already exist
  }
  
  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `figma-design-${timestamp}.md`;
  const filepath = path.join(contextsDir, filename);
  
  // Write context
  fs.writeFileSync(filepath, content, 'utf-8');
  
  return filepath;
}