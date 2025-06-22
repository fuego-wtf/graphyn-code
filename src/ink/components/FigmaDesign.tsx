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
      const tokens = await config.get('figma.oauth') as any;
      
      if (!tokens || !tokens.access_token || tokens.expires_at < Date.now()) {
        setStep('error');
        setErrorMessage('Figma authentication required');
        setAuthInstructions(true);
        return;
      }
      
      const token = tokens.access_token;
      
      setProgress(20);
      setStatusMessage('✅ Figma authenticated');
      
      // Step 2: Initialize Figma API client
      setStep('analyzing');
      setProgress(30);
      setStatusMessage('Connecting to Figma...');
      
      const figmaClient = new FigmaAPIClient(token);
      
      // Parse URL and set file key
      const urlParts = figmaClient.parseUrl(url);
      figmaClient.setCurrentFileKey(urlParts.fileKey);
      
      // Step 3: Analyze prototype
      setProgress(40);
      setStatusMessage('Analyzing Figma prototype...');
      
      let prototypeData;
      try {
        prototypeData = await figmaClient.analyzePrototype(url, (message: string) => {
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
            
            setStatusMessage('⚠️  Limited access - using basic file info');
          } catch (fileError: any) {
            throw new Error(`Cannot access Figma file: ${fileError.message}`);
          }
        } else {
          throw error;
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
          const extractionResponse = await apiClient.post('/api/v1/design/extract', {
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
      
      // Step 6: Generate context for Claude
      setStep('preparing-context');
      setProgress(90);
      setStatusMessage('Preparing design context...');
      
      const context = generateDesignContext(url, prototypeData, plan, framework);
      
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
        setStatusMessage('✅ Claude Code launched with Figma context!');
        
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
        return '❌';
      default:
        return null;
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        🎨 Figma Design Import
      </Text>
      
      <Box marginTop={1}>
        <Text dimColor>URL: {url}</Text>
      </Box>
      
      <Box marginTop={2}>
        <Text>
          {getStepIcon()} {statusMessage}
        </Text>
      </Box>
      
      <Box marginTop={1}>
        <Text>
          [{'█'.repeat(Math.floor(progress / 10)).padEnd(10, '░')}] {progress}%
        </Text>
      </Box>
      
      {step === 'error' && errorMessage && (
        <Box marginTop={2} flexDirection="column">
          <Text color="red">❌ {errorMessage}</Text>
          
          {authInstructions && (
            <Box marginTop={1} flexDirection="column">
              <Text color="yellow">To access Figma files, you need to authenticate:</Text>
              <Text color="cyan">1. Exit this tool (press Ctrl+C)</Text>
              <Text color="cyan">2. Run: graphyn design auth</Text>
              <Text color="cyan">3. Complete OAuth in your browser</Text>
              <Text color="cyan">4. Try again: graphyn design {url}</Text>
            </Box>
          )}
        </Box>
      )}
      
      {prototype && (
        <Box marginTop={2} flexDirection="column" borderStyle="single" padding={1}>
          <Text bold>📐 Prototype Analysis</Text>
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

## Getting Started

1. Use the TodoWrite tool to create all tasks above
2. Start with high priority tasks first
3. Use Figma MCP tools to get exact specifications
4. Test each component as you build

Remember: The goal is pixel-perfect implementation matching the Figma designs exactly.`;
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