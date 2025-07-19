# CLI Init Flow Architecture - The 5-Minute Magic

## Overview

The `graphyn init` command is the critical first experience. Within 5 minutes, a developer should go from zero to generating pixel-perfect components from Figma.

## Init Flow Sequence

```typescript
interface InitFlowSteps {
  1: "Detect repository and suggest project name";
  2: "Open browser for GitHub OAuth";
  3: "Open browser for Figma OAuth";
  4: "Validate MCP compatibility";
  5: "Create first agent via builder thread";
  6: "Generate first Figma component";
  7: "Show subscription value";
}
```

## Technical Implementation

### Step 1: Repository Detection

```typescript
// src/commands/init.ts
import { detect } from '../context/repository-detector';

async function detectRepository() {
  const gitInfo = await detect();
  
  return {
    name: gitInfo.name || "my-project",
    url: gitInfo.remoteUrl,
    branch: gitInfo.branch,
    language: detectLanguage(), // From package.json, go.mod, etc
    framework: detectFramework() // React, Vue, Next.js, etc
  };
}
```

### Step 2-3: OAuth Flow

```typescript
// src/auth/oauth-flow.ts
import { open } from '../utils/browser';
import { createServer } from 'http';

async function initiateOAuth(provider: 'github' | 'figma') {
  // 1. Start local server for callback
  const server = createServer();
  const port = await getAvailablePort();
  
  // 2. Generate state for CSRF protection
  const state = generateSecureState();
  
  // 3. Build OAuth URL
  const authUrl = provider === 'github' 
    ? `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=repo:read,user:email&state=${state}`
    : `https://www.figma.com/oauth?client_id=${FIGMA_CLIENT_ID}&scope=file_read&state=${state}`;
    
  // 4. Open browser
  console.log(chalk.blue(`🌐 Opening browser for ${provider} authentication...`));
  await open(authUrl);
  
  // 5. Wait for callback
  const token = await waitForCallback(server, state);
  
  // 6. Store securely
  await storeToken(provider, token);
  
  console.log(chalk.green(`✅ ${provider} connected successfully!`));
}
```

### Step 4: MCP Validation

```typescript
// src/mcp/validator.ts
async function validateMCPSetup() {
  console.log(chalk.blue('🔍 Checking Claude Code compatibility...'));
  
  // Check if Claude Code is installed
  const claudeInstalled = await checkClaudeCode();
  
  if (!claudeInstalled) {
    console.log(chalk.yellow('⚠️  Claude Code not found'));
    console.log('Install from: https://claude.ai/code');
    
    const { proceed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'proceed',
      message: 'Continue without Claude Code integration?',
      default: true
    }]);
    
    return proceed;
  }
  
  // Check MCP server compatibility
  const mcpCompatible = await checkMCPCompatibility();
  
  if (!mcpCompatible) {
    console.log(chalk.yellow('⚠️  Installing Graphyn MCP server...'));
    await installMCPServer();
  }
  
  console.log(chalk.green('✅ Claude Code integration ready!'));
  return true;
}
```

### Step 5: First Agent Creation

```typescript
// src/agents/quick-builder.ts
async function createFirstAgent(context: ProjectContext) {
  console.log(chalk.blue('🤖 Let\'s create your first agent!'));
  
  // Quick agent templates based on project type
  const templates = getAgentTemplates(context.framework);
  
  const { agentType } = await inquirer.prompt([{
    type: 'list',
    name: 'agentType',
    message: 'What kind of agent would you like?',
    choices: [
      { name: '🎨 Design Agent - Figma to perfect code', value: 'design' },
      { name: '🏗️  Architect - System design expert', value: 'architect' },
      { name: '🔧 Backend Dev - API specialist', value: 'backend' },
      { name: '✨ Custom - Create your own', value: 'custom' }
    ]
  }]);
  
  if (agentType === 'design') {
    // Fast track for design agent
    return createDesignAgent(context);
  }
  
  // Open builder thread for other types
  const builderUrl = `${GRAPHYN_APP_URL}/agents/new?type=${agentType}&repo=${context.url}`;
  console.log(chalk.blue(`🌐 Opening agent builder...`));
  await open(builderUrl);
  
  // Poll for agent creation
  const agent = await pollForAgentCreation();
  return agent;
}
```

### Step 6: First Figma Component

```typescript
// src/commands/init-demo.ts
async function generateFirstComponent() {
  console.log(chalk.blue('✨ Let\'s generate your first component!'));
  
  const { figmaUrl } = await inquirer.prompt([{
    type: 'input',
    name: 'figmaUrl',
    message: 'Paste a Figma component URL (or press Enter for demo):',
    default: 'https://www.figma.com/file/demo/ButtonComponent'
  }]);
  
  // Show live extraction
  const spinner = ora('Extracting design specifications...').start();
  
  const specs = await extractFigmaSpecs(figmaUrl);
  spinner.succeed('Design extracted!');
  
  // Show what we found
  console.log(chalk.gray('📐 Found:'));
  console.log(chalk.gray(`  • Size: ${specs.width}x${specs.height}`));
  console.log(chalk.gray(`  • Colors: ${Object.keys(specs.colors).length} unique`));
  console.log(chalk.gray(`  • Spacing: Pixel-perfect margins`));
  
  // Generate code
  spinner.start('Generating pixel-perfect code...');
  const code = await generateComponent(specs);
  spinner.succeed('Component generated!');
  
  // Save and show
  const filePath = await saveComponent(code);
  console.log(chalk.green(`✅ Saved to: ${filePath}`));
  
  // Show the code
  console.log('\n' + chalk.dim('─'.repeat(50)));
  console.log(highlightCode(code.preview));
  console.log(chalk.dim('─'.repeat(50)) + '\n');
  
  return filePath;
}
```

### Step 7: Show Value Proposition

```typescript
// src/commands/init-complete.ts
async function showValueProp(metrics: InitMetrics) {
  console.log(chalk.green.bold('\n🎉 Graphyn Ultra is ready!\n'));
  
  // Show what they just did
  console.log(chalk.white('In just ' + chalk.bold(metrics.timeElapsed) + ', you:'));
  console.log(chalk.gray('  ✓ Connected your repository'));
  console.log(chalk.gray('  ✓ Integrated with Figma'));
  console.log(chalk.gray('  ✓ Created your first agent'));
  console.log(chalk.gray('  ✓ Generated pixel-perfect code'));
  
  // Calculate time saved
  const timeSaved = calculateTimeSaved(metrics.componentComplexity);
  console.log(chalk.blue(`\n💰 You just saved ~${timeSaved} of development time!`));
  
  // Show subscription value
  console.log(chalk.white('\nWith Graphyn Ultra ($39/month), you get:'));
  console.log(chalk.gray('  • Unlimited Figma extractions'));
  console.log(chalk.gray('  • Unlimited organizations'));
  console.log(chalk.gray('  • Team agent sharing'));
  console.log(chalk.gray('  • AI that learns your patterns'));
  console.log(chalk.gray('  • Save 10+ hours every month'));
  
  const { subscribe } = await inquirer.prompt([{
    type: 'confirm',
    name: 'subscribe',
    message: 'Start your Graphyn Ultra subscription?',
    default: true
  }]);
  
  if (subscribe) {
    const subscribeUrl = `${GRAPHYN_APP_URL}/subscribe?ref=cli-init`;
    await open(subscribeUrl);
  }
  
  // Show next steps
  console.log(chalk.blue('\n📚 Next steps:'));
  console.log(chalk.gray('  graphyn design <figma-url>  Generate any component'));
  console.log(chalk.gray('  graphyn share agent         Share with your team'));
  console.log(chalk.gray('  graphyn --help              See all commands'));
}
```

## Complete Init Flow Code

```typescript
// src/commands/init.ts
export async function init() {
  console.clear();
  console.log(gradient.rainbow(figlet.textSync('Graphyn')));
  console.log(chalk.dim('Every codebase deserves its own development team\n'));
  
  const startTime = Date.now();
  const metrics: InitMetrics = {};
  
  try {
    // Step 1: Detect repository
    const context = await detectRepository();
    console.log(chalk.green(`✅ Found project: ${context.name}`));
    
    // Step 2-3: OAuth flows
    await initiateOAuth('github');
    await initiateOAuth('figma');
    
    // Step 4: MCP validation
    await validateMCPSetup();
    
    // Step 5: Create first agent
    const agent = await createFirstAgent(context);
    metrics.agentCreated = agent.name;
    
    // Step 6: Generate first component
    if (agent.type === 'design') {
      const componentPath = await generateFirstComponent();
      metrics.componentGenerated = componentPath;
    }
    
    // Step 7: Show value
    metrics.timeElapsed = formatTime(Date.now() - startTime);
    await showValueProp(metrics);
    
  } catch (error) {
    console.error(chalk.red('❌ Setup failed:'), error.message);
    console.log(chalk.gray('\nNeed help? Visit https://graphyn.com/support'));
    process.exit(1);
  }
}
```

## Error Handling & Edge Cases

```typescript
// Graceful degradation for each step
const errorHandlers = {
  github: () => console.log(chalk.yellow('⚠️  GitHub optional for now')),
  figma: () => console.log(chalk.yellow('⚠️  Figma needed for design agent')),
  mcp: () => console.log(chalk.yellow('⚠️  MCP enhances Claude Code')),
  agent: () => console.log(chalk.yellow('⚠️  Create agents anytime'))
};
```

## Success Metrics

- Time to first component: < 5 minutes
- Steps to value: 7 or less
- Drop-off rate: < 10% per step
- Subscription conversion: > 20% on first run