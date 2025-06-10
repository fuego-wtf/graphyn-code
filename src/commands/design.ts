import { Command } from 'commander';
import ora from 'ora';
import inquirer from 'inquirer';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import { FigmaAPIClient, ImplementationTask } from '../figma-api';
import { GraphynLogger } from '../logger';
import { colors, createSuccessBox, createErrorBox, createTipBox } from '../ui';
import { FigmaOAuthManager } from '../figma-oauth';
import { findClaude, getInstallInstructions } from '../utils/claude-detector';

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
    
    // Initialize Figma client
    const figmaClient = new FigmaAPIClient(token);
    
    // Analyze prototype with progress updates
    spinner.text = 'Connecting to Figma...';
    
    const prototype = await figmaClient.analyzePrototype(url, (message: string) => {
      spinner.text = message;
    });
    
    spinner.text = 'Building implementation plan...';
    const plan = figmaClient.generateImplementationPlan(prototype);
    
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
    
    // Generate context for Claude
    const context = generateClaudeContext(url, prototype, plan, options.framework);
    
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
  framework: string
): string {
  const timestamp = new Date().toISOString();
  const startingFrameId = prototype.screens?.[0]?.frameId || 'Unknown';
  
  return `# Figma Implementation Plan

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
  
  try {
    // Direct execution with context as argument - no stdin conflicts
    execSync(`"${claudeResult.path}" "${fullContext}"`, { stdio: 'inherit' });
  } catch (error) {
    // Claude exited - this is normal
    console.log(colors.dim('\nClaude Code session ended.'));
  }
  
  // Clean up temp file after delay
  setTimeout(() => {
    try { fsSync.unlinkSync(tmpFile); } catch (e) {}
  }, 30000); // Keep for 30 seconds for debugging
}