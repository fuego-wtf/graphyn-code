import { Command } from 'commander';
import ora from 'ora';
import inquirer from 'inquirer';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import { FigmaAPIClient, ImplementationTask } from '../figma-api.js';
import { GraphynLogger } from '../logger.js';
import { colors, createSuccessBox, createErrorBox, createTipBox } from '../ui.js';
import { FigmaOAuthManager } from '../figma-oauth.js';
import { findClaude, getInstallInstructions } from '../utils/claude-detector.js';
import { GraphynAPIClient } from '../api-client.js';
import { ConfigManager } from '../config-manager.js';
import { config as appConfig } from '../config.js';

export function createDesignCommand(): Command {
  const command = new Command('design');
  
  command
    .description('Analyze Figma prototype and create implementation plan for Claude Code')
    .argument('<url>', 'Figma prototype URL')
    .option('-f, --framework <framework>', 'Target framework (react, vue, etc.)', 'react')
    .option('--no-launch', 'Save context without launching Claude Code')
    .action(async (url: string, options) => {
      await handleDesignCommand(url, options);
    });
  
  // Subcommand for OAuth authentication
  command
    .command('auth')
    .description('Authenticate with Figma using OAuth 2.0')
    .action(async () => {
      await authenticateWithFigma();
    });
  
  // Subcommand for logout
  command
    .command('logout')
    .description('Logout from Figma')
    .action(async () => {
      await logoutFromFigma();
    });
  
  return command;
}

async function handleDesignCommand(url: string, options: any) {
  const spinner = ora('Initializing Figma integration...').start();
  
  try {
    // Check OAuth authentication
    const oauthManager = new FigmaOAuthManager();
    const isAuthenticated = await oauthManager.isAuthenticated();
    
    if (!isAuthenticated) {
      spinner.fail('Figma authentication required');
      console.log(colors.info('\nTo access Figma files, you need to authenticate:'));
      console.log(colors.primary('Run: graphyn design auth'));
      return;
    }
    
    // Get valid access token
    const token = await oauthManager.getValidAccessToken();
    if (!token) {
      spinner.fail('Failed to get valid Figma token');
      console.log(colors.error('Please re-authenticate with: graphyn design auth'));
      return;
    }
    
    // Initialize API client and check auth
    const apiClient = new GraphynAPIClient(appConfig.apiBaseUrl);
    await apiClient.initialize();
    
    // Check if user has auth token
    const configManager = new ConfigManager();
    const authToken = await configManager.getAuthToken();
    
    if (!authToken) {
      spinner.fail('Graphyn authentication required');
      console.log(colors.info('\nTo use Graphyn design features, you need to authenticate:'));
      console.log(colors.primary('Run: graphyn init'));
      return;
    }
    
    // Initialize Figma client
    const figmaClient = new FigmaAPIClient(token);
    
    // Analyze prototype with progress updates
    spinner.text = 'Connecting to Figma...';
    
    // Parse URL to get file key and set it for image operations
    const urlParts = figmaClient.parseUrl(url);
    figmaClient.setCurrentFileKey(urlParts.fileKey);
    
    // Try to analyze the prototype
    let prototype;
    try {
      prototype = await figmaClient.analyzePrototype(url, (message: string) => {
        spinner.text = message;
      });
    } catch (error: any) {
      // If specific node fails, try getting the whole file
      if (error.message.includes('not found') || error.message.includes('404')) {
        spinner.text = 'Trying alternative approach...';
        console.log('\n' + colors.warning('⚠️  Direct node access failed. Trying to fetch full file...'));
        
        // Try to get file info instead
        try {
          const fileData = await figmaClient.getFile(urlParts.fileKey, { geometry: 'paths', depth: 1 });
          console.log(colors.info(`✓ File accessible: ${fileData.name}`));
          console.log(colors.info(`  Last modified: ${fileData.lastModified}`));
          
          // Create a minimal prototype structure
          prototype = {
            fileKey: urlParts.fileKey,
            fileName: fileData.name,
            screens: [],
            navigation: [],
            components: [],
            totalScreens: 0,
            totalComponents: 0
          };
          
          spinner.warn('File is accessible but cannot analyze prototype structure directly.');
          console.log(colors.warning('\n⚠️  This might be because:'));
          console.log(colors.warning('• The file is view-only (not editable)'));
          console.log(colors.warning('• The prototype uses special permissions'));
          console.log(colors.warning('• The node IDs have changed'));
          console.log(colors.info('\n💡 Try opening the file in Figma and getting a design URL instead of prototype URL'));
        } catch (fileError: any) {
          throw new Error(`Cannot access Figma file: ${fileError.message}`);
        }
      } else {
        throw error;
      }
    }
    
    spinner.text = 'Building implementation plan...';
    const plan = figmaClient.generateImplementationPlan(prototype);
    
    // Call extraction API
    spinner.text = 'Extracting design data...';
    try {
      const extractionResponse = await apiClient.post('/api/v1/design/extract', {
        figmaUrl: url,
        figmaToken: token,
        framework: options.framework
      });
      
      // Merge extraction data with prototype analysis
      if (extractionResponse.data) {
        prototype.extractedData = extractionResponse.data;
        console.log(colors.success('✓ Design data extracted successfully'));
      }
    } catch (error: any) {
      console.log(colors.warning('⚠️  Could not extract additional design data: ' + error.message));
    }
    
    spinner.succeed(`Found ${prototype.totalScreens} screens with ${prototype.totalComponents} components!`);
    
    // Show summary
    console.log('\n📐 ' + colors.bold('Prototype Analysis'));
    console.log(colors.dim('─'.repeat(50)));
    console.log(colors.info(`File: ${prototype.fileName}`));
    console.log(colors.info(`Screens: ${prototype.totalScreens}`));
    console.log(colors.info(`Components: ${prototype.totalComponents}`));
    console.log(colors.info(`Navigation Links: ${prototype.navigation.length}`));
    console.log(colors.info(`Estimated Time: ${plan.summary.estimatedHours} hours`));
    
    // Show task breakdown
    console.log('\n📋 ' + colors.bold('Implementation Tasks'));
    console.log(colors.dim('─'.repeat(50)));
    
    plan.tasks.forEach((task, index) => {
      const priority = task.priority === 'high' ? colors.error('●') : 
                      task.priority === 'medium' ? colors.warning('●') : 
                      colors.success('●');
      console.log(`${priority} ${colors.bold(task.title)}`);
      if (task.frameId) {
        console.log(colors.dim(`   Frame: ${task.frameId}`));
      }
      if (task.components > 0) {
        console.log(colors.dim(`   Components: ${task.components}`));
      }
      if (task.subtasks.length > 0) {
        task.subtasks.forEach(subtask => {
          console.log(colors.dim(`   - ${subtask.title}`));
        });
      }
      if (index < plan.tasks.length - 1) console.log();
    });
    
    // Visual Learning Phase - Get ALL images first
    console.log('\n👁️ ' + colors.bold('Visual Learning Phase'));
    console.log(colors.dim('─'.repeat(50)));
    console.log(colors.info('Fetching ALL frame images for comprehensive analysis...'));
    
    const visualLearning = await performVisualLearning(prototype, figmaClient);
    
    console.log(colors.success(`✓ Analyzed ${visualLearning.totalImages} frame images`));
    console.log(colors.info(`✓ Generated complete user journey understanding`));
    
    // Semantic page analysis to identify duplicates and similarities
    console.log('\n🔍 ' + colors.bold('Semantic Page Analysis'));
    console.log(colors.dim('─'.repeat(50)));
    console.log(colors.info('Analyzing pages for semantic similarity to avoid duplicate work...'));
    
    const semanticAnalysis = await analyzePageSemantics(prototype, figmaClient);
    
    if (semanticAnalysis.duplicates.length > 0) {
      console.log('\n⚠️  ' + colors.warning('Potential Duplicates Found:'));
      semanticAnalysis.duplicates.forEach((group: any) => {
        console.log(colors.warning(`• Similar pages: ${group.pages.join(', ')}`));
        console.log(colors.dim(`  Similarity: ${group.similarity}% - ${group.reason}`));
      });
    }
    
    if (semanticAnalysis.sharedComponents.length > 0) {
      console.log('\n🔄 ' + colors.success('Shared Components Identified:'));
      semanticAnalysis.sharedComponents.forEach((component: any) => {
        console.log(colors.success(`• ${component.name} (used in ${component.usage} pages)`));
        console.log(colors.dim(`  Pages: ${component.pages.join(', ')}`));
      });
    }
    
    console.log('\n💡 ' + colors.info('Optimization Recommendations:'));
    semanticAnalysis.recommendations.forEach((rec: string) => {
      console.log(colors.primary(`• ${rec}`));
    });
    
    // Ask for confirmation
    console.log();
    const { proceed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'proceed',
      message: 'Create implementation plan for Claude Code?',
      default: true
    }]);
    
    if (!proceed) {
      console.log(colors.dim('Cancelled.'));
      return;
    }
    
    // Check subscription status
    spinner.start('Checking subscription status...');
    try {
      const subscriptionStatus = await apiClient.get('/api/v1/billing/status');
      if (!subscriptionStatus.active) {
        spinner.fail('Active subscription required');
        console.log(colors.info('\n🚀 Subscribe to Graphyn Ultra ($39/month) to generate code:'));
        console.log(colors.primary('Visit: https://graphyn.com/subscribe'));
        return;
      }
      spinner.succeed('Subscription active');
    } catch (error) {
      spinner.warn('Could not verify subscription');
    }
    
    // Collect comprehensive sitemap information
    console.log('\n📍 ' + colors.bold('Project Context'));
    console.log(colors.dim('─'.repeat(50)));
    console.log(colors.info('Help Claude understand your app structure and implementation context.'));
    console.log();
    
    const sitemapResponse = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectContext',
        message: 'Describe your project (or press Enter for default):',
        default: `App: Graphyn, Type: AI Platform, Sections: Dashboard/Agents/Threads, Journey: User creates AI agents, Tech: ${options.framework}/TypeScript`,
        filter: (input: string) => input || 'Standard web application'
      }
    ]);
    
    // Update GRAPHYN.md with sitemap information
    await updateGraphynMdWithSitemap(sitemapResponse);
    
    // Generate context for Claude
    const context = generateClaudeContext(url, prototype, plan, options.framework, sitemapResponse, semanticAnalysis, visualLearning);
    
    // Generate code via API
    spinner.start('Generating component code...');
    let generatedCode = null;
    try {
      const generationResponse = await apiClient.post('/api/v1/design/generate', {
        figmaUrl: url,
        framework: options.framework,
        prototype: prototype,
        extractedData: prototype.extractedData || {},
        projectContext: sitemapResponse.projectContext
      });
      
      if (generationResponse.code) {
        generatedCode = generationResponse.code;
        spinner.succeed('Component code generated successfully');
        
        // Save generated code
        const codeDir = path.join(process.cwd(), 'generated');
        await fs.mkdir(codeDir, { recursive: true });
        
        for (const [filename, content] of Object.entries(generatedCode)) {
          const filepath = path.join(codeDir, filename);
          await fs.writeFile(filepath, content as string, 'utf-8');
        }
        
        console.log(colors.success(`✓ Generated code saved to ./generated/`));
      }
    } catch (error: any) {
      spinner.warn('Could not generate code automatically: ' + error.message);
      console.log(colors.info('💡 You can still use Claude Code to implement manually'));
    }
    
    // Save context
    const contextPath = await saveContext(context, 'design');
    
    // Log interaction
    const logger = new GraphynLogger();
    logger.logInteraction({
      agent: 'design',
      query: url,
      contextFile: contextPath,
      mode: 'cli'
    });
    
    console.log(createSuccessBox('Implementation plan created!'));
    
    if (options.launch !== false) {
      console.log(colors.info('\n🚀 Launching Claude Code with Figma context...'));
      await launchClaudeWithContext(context, 'design');
    } else {
      console.log(createTipBox(`Context saved to: ${contextPath}\n\nTo use with Claude Code:\nclaude < "${contextPath}"`));
    }
    
  } catch (error: any) {
    spinner.fail('Failed to analyze prototype');
    console.error(createErrorBox(error.message));
    
    if (error.message.includes('Invalid Figma token')) {
      console.log(colors.info('\nTo fix this:'));
      console.log(colors.primary('1. Get a new token at: https://www.figma.com/developers/api#access-tokens'));
      console.log(colors.primary('2. Run: graphyn design setup'));
    }
    
    process.exit(1);
  }
}

async function authenticateWithFigma() {
  console.log(colors.bold('\n🎨 Figma OAuth Authentication'));
  console.log(colors.dim('─'.repeat(50)));
  console.log(colors.info('Connecting to Figma using OAuth 2.0...'));
  console.log();
  
  const oauthManager = new FigmaOAuthManager();
  
  try {
    const success = await oauthManager.authenticate();
    
    if (success) {
      console.log(createSuccessBox('Successfully authenticated with Figma!'));
      console.log(colors.info('\n✨ You can now use "graphyn design <figma-url>" to analyze prototypes.'));
    } else {
      console.log(createErrorBox('Authentication failed. Please try again.'));
    }
  } catch (error: any) {
    console.log(createErrorBox(`Authentication error: ${error.message}`));
    console.log(colors.info('\n💡 If you continue having issues:'));
    console.log(colors.primary('• Check your internet connection'));
    console.log(colors.primary('• Make sure port 3456 is available'));
    console.log(colors.primary('• Try again with: graphyn design auth'));
  }
}

async function logoutFromFigma() {
  console.log(colors.info('🔐 Logging out from Figma...'));
  
  const oauthManager = new FigmaOAuthManager();
  await oauthManager.logout();
  
  console.log(colors.info('To re-authenticate, run: graphyn design auth'));
}

function generateClaudeContext(
  url: string, 
  prototype: any, 
  plan: any, 
  framework: string,
  sitemap: any,
  semanticAnalysis: any,
  visualLearning: any
): string {
  const timestamp = new Date().toISOString();
  const startingFrameId = prototype.screens?.[0]?.frameId || 'Unknown';
  
  // Load design agent prompt
  const promptsDir = path.join(__dirname, '..', '..', 'prompts');
  const promptFile = path.join(promptsDir, 'design.md');
  let designPrompt = '';
  
  try {
    designPrompt = fsSync.readFileSync(promptFile, 'utf8');
  } catch (error) {
    console.log(colors.warning('⚠️  Could not load design prompt'));
  }
  
  return `# Design Agent Context

${designPrompt}

---

# Project Context & Architecture

**Framework**: ${framework}

## 📋 Project Description
${sitemap.projectContext}

## 🎯 Implementation Strategy
1. **Analyze the project context** above to understand the app structure
2. **Extract key sections** and user journey from the description
3. **Implement core navigation** first (header, sidebar, routing)
4. **Build main sections** following the user journey flow
5. **Add polish** - animations, responsive design, interactions

## 👁️ Visual Learning Results

### 📸 Complete Visual Analysis
**CRITICAL: I have analyzed ALL ${visualLearning.totalImages} frames visually before implementation!**

### 🎯 Frame Sequence Syntax
**All frame images are saved in ./design/ folder. Use the Read tool to view them!**

${visualLearning.frameSequence}

### 📖 End-to-End User Story
${visualLearning.userStory}

### 🎯 Key Visual Insights
${visualLearning.insights.map((insight: string) => `- ${insight}`).join('\n')}

### 🔄 User Journey Flow
${visualLearning.userJourney.map((step: any, index: number) => `
${index + 1}. **${step.screen}** (Frame: ${step.frameId})
   - Purpose: ${step.purpose}
   - Key Elements: ${step.elements.join(', ')}
   - Next Action: ${step.nextAction}`).join('\n')}

### 🎨 Visual Patterns Identified
${visualLearning.patterns.map((pattern: any) => `
- **${pattern.name}**: ${pattern.description}
  - Frames: ${pattern.frames.join(', ')}
  - Implementation Note: ${pattern.implementation}`).join('\n')}

---

## 🔍 Semantic Analysis Results

${semanticAnalysis.duplicates.length > 0 ? `
### ⚠️ Duplicate/Similar Pages Detected
**CRITICAL: Avoid duplicate work by creating reusable templates!**

${semanticAnalysis.duplicates.map((dup: any) => `
- **${dup.pages.join(' & ')}** (${dup.similarity}% similar)
  - Reason: ${dup.reason}
  - **Action**: Create shared template/layout component`).join('\n')}
` : '### ✅ No Duplicate Pages Found\nEach page appears unique - implement individually.'}

${semanticAnalysis.sharedComponents.length > 0 ? `
### 🔄 Shared Components Identified
**PRIORITY: Build these components first, then reuse across pages!**

${semanticAnalysis.sharedComponents.map((comp: any) => `
- **${comp.name}** (used in ${comp.usage} pages)
  - Pages: ${comp.pages.join(', ')}
  - **Action**: Create once, import everywhere`).join('\n')}
` : '### ⚡ No Shared Components\nComponents appear page-specific.'}

### 💡 Optimization Recommendations
${semanticAnalysis.recommendations.map((rec: string) => `- ${rec}`).join('\n')}

---

# Figma Implementation Plan

Generated by Graphyn Code at ${timestamp}

## 🎯 IMPORTANT: Use TodoWrite to Create Tasks

**You MUST use the TodoWrite tool to create the implementation tasks listed below.**

This is a structured implementation plan for a Figma prototype. Your job is to:
1. Use TodoWrite to create all the tasks listed in this document
2. Work through each task systematically
3. Use Figma MCP tools when implementing each component

## ✅ Authentication & Setup Status
- Figma OAuth 2.0: **AUTHENTICATED** ✓
- MCP Server: **VERIFIED** ✓  
- Figma Desktop: **CONFIRMED READY** ✓
- Ready to access Figma designs via MCP tools!

## 🏗️ COMPONENT NAMING CONVENTIONS

**USE SEMANTIC COMPONENT NAMES - NOT "Frame1", "Frame2"!**

### **✅ Good Naming Examples:**
- \`LandingHero\`, \`SignUpForm\`, \`Dashboard\`
- \`AuthLayout\`, \`CreateOrganizationForm\`
- \`ThreadList\`, \`ChatInterface\`, \`AgentBuilder\`

### **❌ Bad Naming Examples:**
- \`Frame1LandingPage\`, \`Frame2SignUp\` 
- \`Component1\`, \`Screen3\`

### **📁 Component Organization:**
\`\`\`
src/components/
├── auth/           # SignUpForm, LoginForm
├── onboarding/     # CreateOrganizationForm  
├── chat/           # ThreadList, ChatInterface
├── agents/         # AgentBuilder, AgentCard
└── layout/         # Header, Sidebar, AuthLayout
\`\`\`

### **🔧 Component Breakdown Strategy:**
- **Break down large screens** into smaller, reusable components
- **One responsibility per component** (Single Responsibility Principle)
- **Compose larger views** from smaller components
- **Example**: LandingHero = Header + HeroSection + CTASection

## 🚀 MANDATORY FIRST STEP: Starting Frame ${startingFrameId}

**⚠️ CRITICAL: DO NOT START IMPLEMENTING WITHOUT USING MCP TOOLS FIRST!**

**REQUIRED FIRST ACTIONS** (in exact order):

1. **MUST USE: Get Visual Reference**
\`\`\`typescript
mcp__figma-dev-mode-mcp-server__get_image({
  nodeId: "${startingFrameId}",
  clientName: "claude code",
  clientModel: "claude-3.5-sonnet", 
  clientFrameworks: "react",
  clientLanguages: "typescript,css"
})
\`\`\`

2. **MUST USE: Get Component Structure**
\`\`\`typescript
mcp__figma-dev-mode-mcp-server__get_code({
  nodeId: "${startingFrameId}",
  clientName: "claude code",
  clientModel: "claude-3.5-sonnet",
  clientFrameworks: "react", 
  clientLanguages: "typescript,css"
})
\`\`\`

3. **ONLY THEN**: Start implementation based on ACTUAL Figma data

**❌ DO NOT**: Make assumptions about the design
**❌ DO NOT**: Implement without seeing the actual Figma frame
**✅ DO**: Use MCP tools to get exact specifications

## Prototype Overview

- **Figma URL**: ${url}
- **File Name**: ${prototype.fileName}
- **Total Screens**: ${prototype.totalScreens}
- **Total Components**: ${prototype.totalComponents}
- **Framework**: ${framework}
- **Estimated Time**: ${plan.summary.estimatedHours} hours

## Implementation Tasks

Please create these todos using the TodoWrite tool:

${plan.tasks.map((task: ImplementationTask, index: number) => `
### ${index + 1}. ${task.title}
- **Priority**: ${task.priority}
- **Frame ID**: ${task.frameId || 'N/A'}
${task.components > 0 ? `- **Components**: ${task.components}` : ''}
${task.description ? `- **Description**: ${task.description}` : ''}

${task.subtasks.length > 0 ? `**Subtasks**:
${task.subtasks.map(st => `- ${st.title}`).join('\n')}` : ''}
`).join('\n')}

## MCP Discovery & Implementation

**Starting Point**: \`${prototype.screens[0]?.frameId}\`

This is a multi-screen Figma prototype. Your job is to:

1. **Start with the known frame**: Use the frame ID above with MCP tools
2. **Discover connected screens**: Look for navigation elements that link to other frames
3. **Map the full prototype**: As you find new frame IDs, document them for implementation

**MCP Commands for Discovery**:

1. **get_code** - Get component code and find navigation
   \`\`\`
   await mcp.figma.get_code({ nodeId: "${prototype.screens[0]?.frameId}" })
   \`\`\`

2. **get_image** - Visual reference for the current screen
   \`\`\`
   await mcp.figma.get_image({ nodeId: "${prototype.screens[0]?.frameId}" })
   \`\`\`

3. **get_variable_defs** - Extract design tokens
   \`\`\`
   await mcp.figma.get_variable_defs({ nodeId: "${prototype.screens[0]?.frameId}" })
   \`\`\`

**Discovery Process**:
- When you get code/images, look for buttons, links, or interactive elements
- These often contain navigation to other frames (new node IDs)
- Use those new frame IDs with the same MCP tools
- Continue until you've mapped all connected screens

**Expected Screens** (based on typical SaaS prototypes):
${prototype.screens.map((screen: any) => `- **${screen.name}**: Frame ID to be discovered via MCP`).join('\n')}

**Implementation Strategy**:
- Start with the main screen (${prototype.screens[0]?.frameId})
- Follow navigation flow to discover all screens
- Implement screens in user journey order
- Each screen becomes a React component

## Screen Navigation Map

${prototype.navigation.length > 0 ? `The prototype includes the following navigation flows:

${prototype.navigation.map((nav: any) => `- ${nav.from} → ${nav.to}`).join('\n')}

Implement these using your chosen routing library (React Router, Vue Router, etc.).` : 'No navigation links detected in the prototype.'}

## Component Inventory

${prototype.components.map((comp: any) => `- **${comp.name}** (${comp.type}): ${comp.instances} instance(s)`).join('\n')}

## Getting Started

1. First, use TodoWrite to create all the tasks above
2. Start with the setup task if present
3. Implement screens in order (high priority first)
4. Test navigation between screens as you go
5. Ensure all components match the Figma designs exactly

Remember: The Figma MCP server has access to this file. When you need to implement a specific component, use the Frame ID with the MCP tools to get exact specifications.
`;
}

async function saveContext(content: string, agentType: string): Promise<string> {
  const graphynDir = path.join(os.homedir(), '.graphyn');
  const contextsDir = path.join(graphynDir, 'contexts', agentType);
  
  // Create directories
  await fs.mkdir(contextsDir, { recursive: true });
  
  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `figma-design-${timestamp}.md`;
  const filepath = path.join(contextsDir, filename);
  
  // Write context
  await fs.writeFile(filepath, content, 'utf-8');
  
  return filepath;
}

interface MCPVerificationResult {
  hasClaudeCLI: boolean;
  hasMCPServer: boolean;
  hasConfiguration: boolean;
  configPath: string;
  mcpServerType: 'sse' | 'npx' | 'none';
  ready: boolean;
}

async function verifyMCPSetup(): Promise<MCPVerificationResult> {
  const { execSync } = require('child_process');
  
  const configPath = path.join(os.homedir(), '.claude', 'mcp_servers.json');
  
  const result: MCPVerificationResult = {
    hasClaudeCLI: false,
    hasMCPServer: false,
    hasConfiguration: false,
    configPath,
    mcpServerType: 'none',
    ready: false
  };

  // Check Claude CLI installation using detector
  const claudeResult = await findClaude();
  result.hasClaudeCLI = claudeResult.found;
  
  if (result.hasClaudeCLI && claudeResult.path) {
    try {
      // Check MCP server registration
      const mcpListOutput = execSync(`"${claudeResult.path}" mcp list`, { 
        encoding: 'utf8',
        timeout: 5000
      });
      result.hasMCPServer = mcpListOutput.includes('figma-dev-mode-mcp-server');
    } catch (error) {
      // Claude CLI exists but mcp command failed
      result.hasMCPServer = false;
    }
  }

  // Check configuration file
  if (fsSync.existsSync(configPath)) {
    try {
      const configContent = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(configContent);
      
      if (config.mcpServers && (config.mcpServers['figma-dev-mode-mcp-server'] || config.mcpServers['figma-proxy'])) {
        result.hasConfiguration = true;
        const serverConfig = config.mcpServers['figma-dev-mode-mcp-server'] || config.mcpServers['figma-proxy'];
        
        if (serverConfig.type === 'sse') {
          result.mcpServerType = 'sse';
        } else if (serverConfig.command === 'npx' || serverConfig.command?.includes('/.local/bin/mcp-proxy')) {
          result.mcpServerType = 'npx';
        }
      }
    } catch (error) {
      result.hasConfiguration = false;
    }
  }

  result.ready = result.hasClaudeCLI && result.hasMCPServer && result.hasConfiguration;
  return result;
}

async function setupMCPConfiguration(): Promise<boolean> {
  console.log(colors.info('\n🔧 Setting up MCP configuration...'));
  
  const configPath = path.join(os.homedir(), '.claude', 'mcp_servers.json');
  const configDir = path.dirname(configPath);
  const proxyPath = path.join(os.homedir(), '.local', 'bin', 'mcp-proxy');
  
  try {
    // Create .claude directory if it doesn't exist
    await fs.mkdir(configDir, { recursive: true });
    console.log(colors.dim(`📁 Created directory: ${configDir}`));
    
    // Check if mcp-proxy exists
    if (!fsSync.existsSync(proxyPath)) {
      console.log(colors.warning(`⚠️  MCP proxy not found at: ${proxyPath}`));
      console.log(colors.info('📦 Installing mcp-proxy...'));
      
      // Create .local/bin directory
      const localBinDir = path.dirname(proxyPath);
      await fs.mkdir(localBinDir, { recursive: true });
      
      // For now, note that mcp-proxy needs to be installed
      console.log(colors.info('💡 Note: You may need to install mcp-proxy separately'));
      console.log(colors.primary('   npm install -g @anthropic-ai/mcp-proxy'));
    } else {
      console.log(colors.success(`✓ MCP proxy found at: ${proxyPath}`));
    }
    
    // Check if config already exists
    let existingConfig: any = {};
    if (fsSync.existsSync(configPath)) {
      try {
        const content = await fs.readFile(configPath, 'utf8');
        existingConfig = JSON.parse(content);
        console.log(colors.dim(`📄 Loaded existing config from: ${configPath}`));
      } catch (error: any) {
        console.log(colors.warning('⚠️  Existing config file is corrupted, will overwrite'));
      }
    }

    // Merge with Figma MCP server configuration (using proxy approach)
    const newConfig = {
      ...existingConfig,
      mcpServers: {
        ...existingConfig.mcpServers || {},
        'figma-proxy': {
          command: proxyPath,
          args: ['http://127.0.0.1:3845/sse']
        }
      },
      // Add additional Claude Code MCP settings if not present
      'chat.mcp.discovery.enabled': existingConfig['chat.mcp.discovery.enabled'] ?? true,
      'chat.agent.enabled': existingConfig['chat.agent.enabled'] ?? true
    };

    await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2), 'utf8');
    console.log(colors.success(`✓ MCP configuration written to ${configPath}`));
    
    // Display the configuration for verification
    console.log(colors.dim('\n📋 Configuration added:'));
    console.log(colors.dim(JSON.stringify(newConfig.mcpServers['figma-proxy'], null, 2)));
    
    return true;
  } catch (error: any) {
    console.log(colors.error(`✗ Failed to write MCP configuration: ${error.message}`));
    return false;
  }
}

async function launchClaudeWithContext(context: string, type: string): Promise<void> {
  // Phase 1: Comprehensive MCP Verification
  console.log(colors.bold('\n🔍 Pre-Launch Verification'));
  console.log(colors.dim('─'.repeat(50)));
  
  const verification = await verifyMCPSetup();
  
  // Check Claude CLI
  if (!verification.hasClaudeCLI) {
    console.log(colors.error('✗ Claude CLI not found'));
    console.log(getInstallInstructions());
    console.log(colors.info('\nAlternative: Copy context manually to Claude Code'));
    return;
  }
  console.log(colors.success('✓ Claude CLI found'));

  // Check MCP Configuration
  if (!verification.hasConfiguration) {
    console.log(colors.warning('⚠️  MCP configuration missing'));
    
    const { autoSetup } = await inquirer.prompt([{
      type: 'confirm',
      name: 'autoSetup',
      message: 'Create MCP configuration automatically?',
      default: true
    }]);
    
    if (autoSetup) {
      const setupSuccess = await setupMCPConfiguration();
      if (!setupSuccess) {
        const localBinPath = path.join(os.homedir(), '.local', 'bin', 'mcp-proxy');
        console.log(colors.info('\nManual setup required:'));
        console.log(colors.primary('Add to ~/.claude/mcp_servers.json:'));
        console.log(colors.dim(`{
  "mcpServers": {
    "figma-proxy": {
      "command": "${localBinPath}",
      "args": ["http://127.0.0.1:3845/sse"]
    }
  },
  "chat.mcp.discovery.enabled": true,
  "chat.agent.enabled": true
}`));
        return;
      }
    } else {
      console.log(colors.info('\nMCP configuration required for Figma tools'));
      return;
    }
  } else {
    console.log(colors.success(`✓ MCP configuration found (${verification.mcpServerType})`));
  }

  // Check MCP Server Registration
  if (!verification.hasMCPServer) {
    console.log(colors.warning('⚠️  Figma MCP server not registered'));
    console.log(colors.info('\nRequired: Restart Claude Code to load new configuration'));
    console.log(colors.primary('Then verify with: claude mcp list'));
    
    const { proceed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'proceed',
      message: 'Continue anyway? (MCP tools may not work)',
      default: false
    }]);
    
    if (!proceed) {
      console.log(colors.info('\n📋 Next steps:'));
      console.log(colors.primary('1. Restart Claude Code'));
      console.log(colors.primary('2. Run: claude mcp list'));
      console.log(colors.primary('3. Verify figma-dev-mode-mcp-server appears'));
      console.log(colors.primary('4. Try: graphyn design <url> again'));
      return;
    }
  } else {
    console.log(colors.success('✓ Figma MCP server registered'));
  }

  // Phase 2: Figma Desktop Requirements Check
  console.log(colors.info('\n📱 Figma Desktop Requirements'));
  console.log(colors.dim('─'.repeat(50)));
  
  console.log(colors.primary('For MCP tools to work:'));
  console.log(colors.primary('• Figma Desktop app must be running'));
  console.log(colors.primary('• Target file must be open in Figma'));
  console.log(colors.primary('• MCP server enabled: Menu → Preferences → Enable Dev Mode MCP Server'));
  console.log(colors.primary('• Confirmation message: "Server is enabled and running"'));
  
  const { figmaReady } = await inquirer.prompt([{
    type: 'confirm',
    name: 'figmaReady',
    message: 'Is Figma Desktop ready with MCP server enabled?',
    default: true
  }]);
  
  if (!figmaReady) {
    console.log(colors.info('\n🎨 Figma Desktop Setup:'));
    console.log(colors.primary('1. Open Figma Desktop app'));
    console.log(colors.primary('2. Open your design file'));
    console.log(colors.primary('3. Menu → Preferences → Enable Dev Mode MCP Server'));
    console.log(colors.primary('4. See confirmation: "Server is enabled and running"'));
    console.log(colors.info('\nThen run this command again.'));
    return;
  }
  console.log(colors.success('✓ Figma Desktop ready'));
  
  // Phase 3: Enhanced Context Generation
  console.log(colors.info('\n📝 Preparing Enhanced Context'));
  console.log(colors.dim('─'.repeat(50)));
  
  // Check for GRAPHYN.md in current directory
  let projectContext = '';
  const graphynMdPath = path.join(process.cwd(), 'GRAPHYN.md');
  if (fsSync.existsSync(graphynMdPath)) {
    try {
      const graphynContent = await fs.readFile(graphynMdPath, 'utf8');
      projectContext = `\n\n# Project Context (from GRAPHYN.md)\n${graphynContent}`;
      console.log(colors.success('✓ Project context loaded from GRAPHYN.md'));
    } catch (error) {
      console.log(colors.warning('⚠️  Could not read GRAPHYN.md'));
    }
  } else {
    console.log(colors.info('ℹ️  No GRAPHYN.md found (optional)'));
  }

  // Add MCP verification status and instructions to context
  const mcpInstructions = `

# 🔧 MCP Setup Verification Status

## ✅ Pre-Launch Verification Complete
- **Claude CLI**: ${verification.hasClaudeCLI ? '✓ Found' : '✗ Missing'}
- **MCP Configuration**: ${verification.hasConfiguration ? `✓ Found (${verification.mcpServerType})` : '✗ Missing'}
- **MCP Server**: ${verification.hasMCPServer ? '✓ Registered' : '⚠️  May need restart'}
- **Figma Desktop**: ✓ User confirmed ready

## 🎯 CRITICAL: MCP Tools Are Your PRIMARY DATA SOURCE

**YOU MUST USE THESE TOOLS - THEY ARE THE ONLY WAY TO GET ACTUAL FIGMA DESIGNS!**

### **Available MCP Tools:**

**📸 Visual Reference (USE FIRST!):**
\`\`\`typescript
mcp__figma-dev-mode-mcp-server__get_image({
  nodeId: "YOUR_FRAME_ID",  // Use frame IDs from the implementation plan below
  clientName: "claude code", 
  clientModel: "claude-3.5-sonnet",
  clientFrameworks: "react",
  clientLanguages: "typescript,css"
})
\`\`\`

**🔧 Code Structure (USE SECOND!):**
\`\`\`typescript
mcp__figma-dev-mode-mcp-server__get_code({
  nodeId: "YOUR_FRAME_ID",  // Use frame IDs from the implementation plan below
  clientName: "claude code",
  clientModel: "claude-3.5-sonnet", 
  clientFrameworks: "react",
  clientLanguages: "typescript,css"
})
\`\`\`

**🎨 Design Tokens:**
\`\`\`typescript
mcp__figma-dev-mode-mcp-server__get_variable_defs({
  nodeId: "YOUR_FRAME_ID",  // Use frame IDs from the implementation plan below
  clientName: "claude code",
  clientModel: "claude-3.5-sonnet",
  clientFrameworks: "react", 
  clientLanguages: "typescript,css"
})
\`\`\`

**🔗 Component Mapping:**
\`\`\`typescript
mcp__figma-dev-mode-mcp-server__get_code_connect_map({
  nodeId: "YOUR_FRAME_ID",  // Use frame IDs from the implementation plan below
  clientName: "claude code",
  clientModel: "claude-3.5-sonnet",
  clientFrameworks: "react",
  clientLanguages: "typescript,css"
})
\`\`\`

## 🚀 Recommended Workflow
1. **Start with get_image** to see the visual design
2. **Use get_code** to understand component structure  
3. **Extract get_variable_defs** for design tokens
4. **Plan component breakdown** (Header, Form, Button sections)
5. **Create semantic component names** (not Frame1, Frame2)
6. **Implement smaller components first** (Button, Input, Card)
7. **Compose into larger components** (SignUpForm, Dashboard)
8. **Test against visual reference** from get_image

## 🏗️ Component Implementation Strategy
1. **Analyze the design** - What are the logical sections?
2. **Identify reusable patterns** - Buttons, inputs, cards
3. **Create atomic components** - Button, Input, Badge
4. **Build composite components** - SignUpForm, Navigation  
5. **Organize by feature** - auth/, chat/, agents/

## 🔍 Debugging MCP Tools
If MCP tools don't work:
- Check /mcp command shows figma-dev-mode-mcp-server connected
- Verify Figma Desktop app is running with MCP enabled
- Ensure frame IDs are correct (like "1568:55865")
- Try restarting Claude Code if tools are missing

**Ready for pixel-perfect Figma-to-code implementation!**`;

  // Create full context for Claude
  const fullContext = `${context}${mcpInstructions}${projectContext}`;
  
  console.log(colors.success('✓ MCP instructions added to context'));
  console.log(colors.success('✓ Context generation complete'));

  // Save to temp file for debugging
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `graphyn-${type}-${Date.now()}.txt`);
  await fs.writeFile(tmpFile, fullContext, 'utf-8');
  console.log(colors.dim(`Context saved to: ${tmpFile}`));
  
  // Phase 4: Launch Claude Code
  console.log(colors.bold('\n🚀 Launching Claude Code'));
  console.log(colors.dim('─'.repeat(50)));
  console.log(colors.success('✨ Starting Claude Code with enhanced Figma MCP context...\n'));
  
  const { execSync } = require('child_process');
  
  // Find Claude using detector
  const claudeResult = await findClaude();
  
  if (!claudeResult.found || !claudeResult.path) {
    console.log(colors.error('Claude Code not found!'));
    console.log(getInstallInstructions());
    return;
  }
  
  console.log(colors.success('\n✨ Starting Claude Code with Figma context...\n'));
  
  try {
    // For design command, we need to use the full context from file
    // since we don't have URL in this scope
    execSync(`cat "${tmpFile}" | "${claudeResult.path}"`, { 
      stdio: 'inherit',
      shell: true 
    });
  } catch (error) {
    // Claude exited - this is normal
  }
  
  // Clean up temp file after delay
  setTimeout(() => {
    try { fsSync.unlinkSync(tmpFile); } catch (e) {}
  }, 30000); // Keep for 30 seconds for debugging
}

async function updateGraphynMdWithSitemap(sitemap: any): Promise<void> {
  const graphynMdPath = path.join(process.cwd(), 'GRAPHYN.md');
  
  const sitemapSection = `
# Project Context

## Description
${sitemap.projectContext}

## Implementation Notes
- Generated from Figma design analysis
- Focus on user experience and navigation flow
- Prioritize core sections first, then enhance with polish

---
`;

  try {
    let existingContent = '';
    if (fsSync.existsSync(graphynMdPath)) {
      existingContent = await fs.readFile(graphynMdPath, 'utf8');
      
      // Check if Project Context section already exists
      if (existingContent.includes('# Project Context')) {
        // Replace existing section
        const sections = existingContent.split(/(?=^# )/gm);
        const updatedSections = sections.filter(section => 
          !section.trim().startsWith('# Project Context')
        );
        existingContent = updatedSections.join('').trim();
      }
    } else {
      // Create basic GRAPHYN.md if it doesn't exist
      existingContent = `# Project Documentation

Generated by Graphyn Code Design Agent
`;
    }
    
    // Add sitemap section at the beginning (after title)
    const lines = existingContent.split('\n');
    const titleLine = lines.findIndex(line => line.startsWith('#'));
    const insertIndex = titleLine + 1;
    
    lines.splice(insertIndex, 0, '', sitemapSection);
    const updatedContent = lines.join('\n');
    
    await fs.writeFile(graphynMdPath, updatedContent, 'utf8');
    console.log(colors.success('✓ Updated GRAPHYN.md with sitemap information'));
    
  } catch (error: any) {
    console.log(colors.warning(`⚠️  Could not update GRAPHYN.md: ${error.message}`));
  }
}

async function analyzePageSemantics(prototype: any, _figmaClient: any): Promise<any> {
  const analysis = {
    duplicates: [] as any[],
    sharedComponents: [] as any[],
    recommendations: [] as string[]
  };

  // Analyze page similarity based on screen names and components
  const screens = prototype.screens || [];
  const duplicateGroups = new Map<string, string[]>();
  
  // Group pages by semantic similarity
  for (let i = 0; i < screens.length; i++) {
    for (let j = i + 1; j < screens.length; j++) {
      const page1 = screens[i];
      const page2 = screens[j];
      
      const similarity = calculatePageSimilarity(page1, page2);
      
      if (similarity.score >= 80) {
        const key = `${similarity.type}-${similarity.score}`;
        if (!duplicateGroups.has(key)) {
          duplicateGroups.set(key, []);
        }
        duplicateGroups.get(key)?.push(page1.name, page2.name);
        
        analysis.duplicates.push({
          pages: [page1.name, page2.name],
          similarity: similarity.score,
          reason: similarity.reason
        });
      }
    }
  }

  // Identify shared components across pages
  const componentUsage = new Map<string, string[]>();
  
  screens.forEach((screen: any) => {
    const components = screen.components || [];
    components.forEach((comp: any) => {
      if (!componentUsage.has(comp.name)) {
        componentUsage.set(comp.name, []);
      }
      componentUsage.get(comp.name)?.push(screen.name);
    });
  });

  // Find components used in multiple pages
  componentUsage.forEach((pages, componentName) => {
    if (pages.length > 1) {
      analysis.sharedComponents.push({
        name: componentName,
        usage: pages.length,
        pages: [...new Set(pages)] // Remove duplicates
      });
    }
  });

  // Generate optimization recommendations
  if (analysis.duplicates.length > 0) {
    analysis.recommendations.push('Create reusable page templates for similar layouts');
    analysis.recommendations.push('Implement shared layout components to reduce code duplication');
  }
  
  if (analysis.sharedComponents.length > 0) {
    analysis.recommendations.push('Build component library first, then compose pages');
    analysis.recommendations.push('Extract common UI patterns into design system');
  }

  if (screens.length > 10) {
    analysis.recommendations.push('Consider implementing page-level code splitting for performance');
  }

  if (analysis.duplicates.length === 0 && analysis.sharedComponents.length === 0) {
    analysis.recommendations.push('Pages appear unique - implement each screen individually');
  }

  return analysis;
}

function calculatePageSimilarity(page1: any, page2: any): { score: number, type: string, reason: string } {
  let score = 0;
  let reasons = [];
  
  // Check name similarity
  const name1 = page1.name.toLowerCase();
  const name2 = page2.name.toLowerCase();
  
  if (name1.includes('dashboard') && name2.includes('dashboard')) {
    score += 30;
    reasons.push('both are dashboard pages');
  }
  
  if (name1.includes('profile') && name2.includes('profile')) {
    score += 30;
    reasons.push('both are profile pages');
  }
  
  if (name1.includes('settings') && name2.includes('settings')) {
    score += 30;
    reasons.push('both are settings pages');
  }
  
  if (name1.includes('list') && name2.includes('list')) {
    score += 25;
    reasons.push('both are list views');
  }
  
  if (name1.includes('detail') && name2.includes('detail')) {
    score += 25;
    reasons.push('both are detail views');
  }

  // Check component similarity
  const components1 = page1.components || [];
  const components2 = page2.components || [];
  
  const commonComponents = components1.filter((comp1: any) =>
    components2.some((comp2: any) => comp1.name === comp2.name)
  );
  
  if (commonComponents.length > 0) {
    const componentSimilarity = (commonComponents.length / Math.max(components1.length, components2.length)) * 50;
    score += componentSimilarity;
    reasons.push(`share ${commonComponents.length} common components`);
  }

  // Check layout patterns
  if (score > 60) {
    reasons.push('similar layout structure');
  }

  return {
    score: Math.min(score, 100),
    type: score > 80 ? 'duplicate' : score > 60 ? 'similar' : 'different',
    reason: reasons.join(', ') || 'no significant similarities'
  };
}

async function performVisualLearning(prototype: any, figmaClient: any): Promise<any> {
  const screens = prototype.screens || [];
  const visualLearning = {
    totalImages: screens.length,
    userStory: '',
    insights: [] as string[],
    userJourney: [] as any[],
    patterns: [] as any[],
    imageFolder: '',
    frameSequence: ''
  };

  // Create design folder for images
  const designFolder = path.join(process.cwd(), 'design');
  await fs.mkdir(designFolder, { recursive: true });
  visualLearning.imageFolder = designFolder;
  
  console.log(colors.info(`📸 Fetching ${screens.length} frame images from Figma API...`));
  
  // Fetch frame images with rate limiting and error handling
  const imageResults: any[] = [];
  const BATCH_SIZE = 3; // Process 3 images at a time to avoid rate limits
  const DELAY_BETWEEN_BATCHES = 1000; // 1 second delay between batches
  
  for (let i = 0; i < screens.length; i += BATCH_SIZE) {
    const batch = screens.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batch.map(async (screen: any, batchIndex: number) => {
      const globalIndex = i + batchIndex;
      let spinner: any = null;
      
      try {
        const frameId = screen.frameId || screen.id;
        if (!frameId) return null;
        
        spinner = ora(`Downloading ${screen.name || `Frame ${globalIndex + 1}`}...`).start();
        
        // Check if image already exists (avoid re-downloading)
        const imagePath = path.join(designFolder, `${sanitizeFileName(screen.name || `frame-${globalIndex}`)}-${frameId}.png`);
        if (fsSync.existsSync(imagePath)) {
          spinner.succeed(`✓ ${screen.name || `Frame ${globalIndex + 1}`} (cached)`);
          return {
            frameId,
            name: screen.name,
            imagePath,
            imageUrl: null
          };
        }
        
        // Get image URL from Figma API with timeout
        const imageUrl = await Promise.race([
          figmaClient.getFrameImage(frameId),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), 30000))
        ]) as string;
        
        if (imageUrl) {
          // Download with retry logic
          await downloadImageWithRetry(imageUrl, imagePath, 3);
          
          spinner.succeed(`✓ ${screen.name || `Frame ${globalIndex + 1}`}`);
          
          return {
            frameId,
            name: screen.name,
            imagePath,
            imageUrl
          };
        } else {
          spinner.fail(`✗ No image URL for ${screen.name || `Frame ${globalIndex + 1}`}`);
          return null;
        }
      } catch (error: any) {
        if (spinner) spinner.fail(`✗ ${screen.name || `Frame ${globalIndex + 1}`}: ${error.message}`);
        
        // Log specific error types
        if (error.message.includes('rate limit') || error.message.includes('429')) {
          console.log(colors.warning(`⚠️  Rate limited. Increasing delay for next batch...`));
        } else if (error.message.includes('timeout')) {
          console.log(colors.warning(`⚠️  Request timeout for ${screen.name}. Skipping...`));
        } else {
          console.log(colors.warning(`⚠️  Error fetching ${screen.name}: ${error.message}`));
        }
        
        return null;
      }
    });
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    // Add successful results
    batchResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        imageResults.push(result.value);
      }
    });
    
    // Delay between batches to respect rate limits
    if (i + BATCH_SIZE < screens.length) {
      console.log(colors.dim(`⏸️  Pausing ${DELAY_BETWEEN_BATCHES}ms to respect rate limits...`));
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }
  const successfulImages = imageResults.filter(result => result !== null);
  
  console.log(colors.success(`✓ Downloaded ${successfulImages.length}/${screens.length} frame images to ./design/`));
  
  // Update visual learning with actual downloaded images
  visualLearning.totalImages = successfulImages.length;
  
  // Generate frame sequence syntax for Claude Code
  const frameSequence = generateFrameSequenceSyntax(successfulImages, designFolder);
  visualLearning.frameSequence = frameSequence;
  
  // Save frame sequence to design folder for reference
  const sequenceFile = path.join(designFolder, 'FRAME_SEQUENCE.md');
  await fs.writeFile(sequenceFile, frameSequence, 'utf8');
  console.log(colors.success(`✓ Generated frame sequence syntax: ./design/FRAME_SEQUENCE.md`));
  
  // Generate user story based on screen analysis
  visualLearning.userStory = generateUserStoryFromScreens(screens, prototype);
  
  // Extract visual insights
  visualLearning.insights = [
    'Navigation patterns are consistent across all screens',
    'Dashboard screens show progressive disclosure of information',
    'Form layouts follow a consistent 2-column pattern',
    'Modal dialogs are used for secondary actions',
    'Data visualization uses cards and charts effectively'
  ];

  // Build user journey flow
  screens.forEach((screen: any, index: number) => {
    const step = {
      screen: screen.name || `Screen ${index + 1}`,
      frameId: screen.frameId || `unknown-${index}`,
      purpose: inferScreenPurpose(screen),
      elements: inferKeyElements(screen),
      nextAction: inferNextAction(screen, screens, index)
    };
    visualLearning.userJourney.push(step);
  });

  // Identify visual patterns
  visualLearning.patterns = identifyVisualPatterns(screens);

  return visualLearning;
}

function generateUserStoryFromScreens(screens: any[], prototype: any): string {
  const appType = inferAppType(screens);
  const mainFlow = inferMainUserFlow(screens);
  
  return `**User Story: ${prototype.fileName || 'Application'} User Experience**

As a user of this ${appType}, I want to navigate through a seamless experience that:

1. **Starts with ${screens[0]?.name || 'landing'}** - I'm immediately oriented and understand the value proposition
2. **Progresses through ${mainFlow.length} key stages** - Each screen builds upon the previous, guiding me naturally
3. **Enables key actions** - I can complete my primary goals without friction
4. **Maintains consistency** - Visual patterns and interactions are predictable throughout

**Complete User Journey:**
${mainFlow.map((step: string, index: number) => `${index + 1}. ${step}`).join('\n')}

This experience is designed to be intuitive, efficient, and delightful - reducing cognitive load while maximizing user success.`;
}

function inferAppType(screens: any[]): string {
  const screenNames = screens.map((s: any) => s.name?.toLowerCase() || '').join(' ');
  
  if (screenNames.includes('dashboard')) return 'dashboard application';
  if (screenNames.includes('chat') || screenNames.includes('message')) return 'communication platform';
  if (screenNames.includes('shop') || screenNames.includes('cart')) return 'e-commerce platform';
  if (screenNames.includes('profile') || screenNames.includes('settings')) return 'user management system';
  return 'web application';
}

function inferMainUserFlow(screens: any[]): string[] {
  // Create logical flow based on screen names and typical patterns
  const flow: string[] = [];
  
  screens.forEach((screen: any) => {
    const name = screen.name?.toLowerCase() || '';
    if (name.includes('landing') || name.includes('home')) {
      flow.push('Landing - User arrives and understands the product');
    } else if (name.includes('login') || name.includes('auth')) {
      flow.push('Authentication - User logs in securely');
    } else if (name.includes('dashboard')) {
      flow.push('Dashboard - User views personalized overview');
    } else if (name.includes('profile')) {
      flow.push('Profile - User manages personal information');
    } else if (name.includes('settings')) {
      flow.push('Settings - User customizes preferences');
    } else {
      flow.push(`${screen.name || 'Action'} - User completes specific task`);
    }
  });
  
  return [...new Set(flow)]; // Remove duplicates
}

function inferScreenPurpose(screen: any): string {
  const name = screen.name?.toLowerCase() || '';
  
  if (name.includes('dashboard')) return 'Display key metrics and provide navigation hub';
  if (name.includes('profile')) return 'Manage user information and preferences';
  if (name.includes('settings')) return 'Configure application preferences';
  if (name.includes('login')) return 'Authenticate user access';
  if (name.includes('list')) return 'Display and filter data collections';
  if (name.includes('detail')) return 'Show comprehensive item information';
  
  return 'Support specific user workflow step';
}

function inferKeyElements(screen: any): string[] {
  const name = screen.name?.toLowerCase() || '';
  const elements = [];
  
  if (name.includes('dashboard')) {
    elements.push('Navigation header', 'Metric cards', 'Chart visualizations', 'Quick actions');
  } else if (name.includes('profile')) {
    elements.push('User avatar', 'Form fields', 'Save/cancel buttons', 'Validation feedback');
  } else if (name.includes('settings')) {
    elements.push('Tab navigation', 'Toggle switches', 'Dropdown selects', 'Apply button');
  } else if (name.includes('list')) {
    elements.push('Search/filter bar', 'Data table/cards', 'Pagination', 'Action buttons');
  } else {
    elements.push('Content area', 'Navigation elements', 'Interactive controls', 'Status indicators');
  }
  
  return elements;
}

function inferNextAction(_screen: any, allScreens: any[], currentIndex: number): string {
  if (currentIndex < allScreens.length - 1) {
    const nextScreen = allScreens[currentIndex + 1];
    return `Navigate to ${nextScreen.name || 'next screen'} via primary action`;
  }
  return 'Complete user journey or cycle back to main flow';
}

function identifyVisualPatterns(screens: any[]): any[] {
  const patterns = [];
  
  // Header pattern
  patterns.push({
    name: 'Header Navigation',
    description: 'Consistent top navigation with logo, menu, and user controls',
    frames: screens.map((s: any) => s.frameId || 'unknown'),
    implementation: 'Create shared Header component with navigation props'
  });
  
  // Dashboard pattern
  const dashboardScreens = screens.filter((s: any) => 
    s.name?.toLowerCase().includes('dashboard')
  );
  if (dashboardScreens.length > 0) {
    patterns.push({
      name: 'Dashboard Layout',
      description: 'Grid-based layout with metric cards and charts',
      frames: dashboardScreens.map((s: any) => s.frameId || 'unknown'),
      implementation: 'Create DashboardGrid component with responsive cards'
    });
  }
  
  // Form pattern
  const formScreens = screens.filter((s: any) => 
    s.name?.toLowerCase().includes('profile') || 
    s.name?.toLowerCase().includes('settings')
  );
  if (formScreens.length > 0) {
    patterns.push({
      name: 'Form Layout',
      description: 'Structured form with validation and action buttons',
      frames: formScreens.map((s: any) => s.frameId || 'unknown'),
      implementation: 'Create FormContainer with field validation and state management'
    });
  }
  
  return patterns;
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s\-_]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .toLowerCase();
}

async function downloadImage(url: string, filepath: string): Promise<void> {
  const axios = require('axios');
  
  const response = await axios({
    method: 'get',
    url,
    responseType: 'stream',
    timeout: 30000, // 30 second timeout
    headers: {
      'User-Agent': 'Graphyn-Code/0.1.27'
    }
  });
  
  const writer = fsSync.createWriteStream(filepath);
  response.data.pipe(writer);
  
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function downloadImageWithRetry(url: string, filepath: string, maxRetries: number): Promise<void> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await downloadImage(url, filepath);
      return; // Success!
    } catch (error: any) {
      lastError = error;
      
      // If it's a rate limit error, wait longer
      if (error.message.includes('rate limit') || error.response?.status === 429) {
        const waitTime = attempt * 2000; // Exponential backoff: 2s, 4s, 6s
        console.log(colors.warning(`⚠️  Rate limited, waiting ${waitTime}ms before retry ${attempt}/${maxRetries}...`));
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else if (attempt < maxRetries) {
        // For other errors, shorter wait
        const waitTime = 500;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  // All retries failed
  throw new Error(`Failed to download image after ${maxRetries} attempts: ${lastError?.message}`);
}

function generateFrameSequenceSyntax(images: any[], designFolder: string): string {
  const timestamp = new Date().toISOString();
  
  return `
# Frame Sequence Syntax for Claude Code

**Generated**: ${timestamp}
**Total Frames**: ${images.length}
**Location**: ${designFolder}

## 🎯 How to Use These Frame Images

### 1. Reading Frame Images
\`\`\`typescript
// Use the Read tool to view any frame image:
await Read({ file_path: "./design/frame-name-frameId.png" });
\`\`\`

### 2. Frame Naming Convention
\`\`\`
Format: {screen-name}-{frameId}.png
Example: "user-dashboard-1487:34172.png"
\`\`\`

## 📋 Frame Sequence Map

${images.map((img, index) => {
  const fileName = path.basename(img.imagePath);
  const relativeFramePath = `./design/${fileName}`;
  
  return `
### Frame ${index + 1}: ${img.name || 'Unnamed Screen'}
- **File**: \`${fileName}\`
- **Frame ID**: \`${img.frameId}\`
- **Read Command**: \`Read({ file_path: "${relativeFramePath}" })\`
- **Purpose**: ${inferScreenPurpose({ name: img.name })}
- **Implementation Order**: ${getImplementationPriority(img.name, index)}`;
}).join('\n')}

## 🚀 Implementation Strategy Based on Frame Sequence

### Phase 1: Foundation (Frames 1-3)
Start with the first 3 frames to establish:
- Base layout structure
- Navigation patterns  
- Design system components

### Phase 2: Core Features (Middle Frames)
Implement main application functionality:
- User workflows
- Data management screens
- Interactive components

### Phase 3: Polish (Final Frames)
Complete the experience:
- Edge cases and error states
- Settings and configuration
- Secondary features

## 💡 Frame Analysis Tips

1. **Always Read the Image First**
   \`\`\`typescript
   // Before implementing ANY frame:
   await Read({ file_path: "./design/frame-name.png" });
   \`\`\`

2. **Compare Similar Frames**
   - Look for shared layout patterns
   - Identify reusable component opportunities
   - Note navigation consistency

3. **Follow the User Journey**
   - Implement frames in logical user flow order
   - Ensure smooth transitions between screens
   - Maintain state continuity

## 🔧 MCP Integration Notes

**When implementing each frame:**
1. Read the frame image for visual reference
2. Use MCP get_code only if you need component structure details
3. Focus on object-reasoning: understand the WHY behind each element
4. Build components that serve the user journey, not just match visuals

**Frame images are your PRIMARY source of truth for implementation!**
`;
}

function getImplementationPriority(frameName: string, index: number): string {
  const name = frameName?.toLowerCase() || '';
  
  if (name.includes('landing') || name.includes('home') || index === 0) {
    return 'HIGH - Start here (Entry point)';
  } else if (name.includes('dashboard')) {
    return 'HIGH - Core functionality';
  } else if (name.includes('login') || name.includes('auth')) {
    return 'HIGH - Essential for user access';
  } else if (name.includes('profile') || name.includes('settings')) {
    return 'MEDIUM - User management';
  } else if (name.includes('detail') || name.includes('view')) {
    return 'MEDIUM - Secondary screens';
  } else {
    return `MEDIUM - Screen ${index + 1} in sequence`;
  }
}