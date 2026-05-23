import chalk from 'chalk';
import { ProviderManager, ProviderManagerConfig } from '../providers/provider-manager.js';
import { ProviderType } from '../providers/ai-provider.js';

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray,
  highlight: chalk.cyan,
  bold: chalk.bold,
  dim: chalk.dim,
};

export async function runProviderCommand(rawQuery: string): Promise<void> {
  const tokens = rawQuery.split(/\s+/);
  const subcommand = tokens[1] || '';

  const manager = new ProviderManager();

  switch (subcommand) {
    case 'list':
    case 'ls':
      await listCommand(manager);
      break;
    case 'set':
      await setCommand(manager, tokens);
      break;
    case 'test':
      await testCommand(manager, tokens);
      break;
    case 'status':
      await statusCommand(manager);
      break;
    case '':
    case 'help':
    case '--help':
    case '-h':
      showProviderHelp();
      break;
    default:
      console.log(colors.error(`Unknown subcommand: ${subcommand}`));
      showProviderHelp();
      process.exitCode = 1;
  }
}

async function listCommand(manager: ProviderManager): Promise<void> {
  const providers = manager.getAvailableProviders();
  const selected = manager.getSelectedProvider();

  console.log(colors.bold('\n  Available AI Providers\n'));

  for (const p of providers) {
    const isSelected = p.type === selected;
    const marker = isSelected ? colors.success('●') : '○';
    console.log(`  ${marker} ${colors.bold(p.name.padEnd(15))} ${colors.dim(p.description)}`);
  }
  console.log('');
}

async function setCommand(manager: ProviderManager, tokens: string[]): Promise<void> {
  const type = tokens[2] as ProviderType;
  const keyIndex = tokens.indexOf('--key');
  const urlIndex = tokens.indexOf('--url');

  if (!type || !['gemini', 'lmstudio', 'claude-cli'].includes(type)) {
    console.log(colors.error('Usage: graphyn provider set <gemini|lmstudio|claude-cli> [--key <api-key>] [--url <base-url>]'));
    process.exitCode = 1;
    return;
  }

  const updates: Partial<ProviderManagerConfig> = {};
  if (keyIndex > 0 && tokens[keyIndex + 1]) {
    updates.geminiApiKey = tokens[keyIndex + 1];
  }
  if (urlIndex > 0 && tokens[urlIndex + 1]) {
    updates.lmStudioUrl = tokens[urlIndex + 1];
  }

  if (Object.keys(updates).length > 0) {
    manager.updateConfig(updates);
  }

  const provider = await manager.selectProvider(type);
  console.log(colors.success(`\n  Selected: ${provider.info.name}`));

  const health = await manager.healthCheck(type);
  if (health.healthy) {
    console.log(colors.success(`  Status: Healthy (${health.model})`));
  } else {
    console.log(colors.warning(`  Status: ${health.error}`));
  }
  console.log('');
}

async function testCommand(manager: ProviderManager, tokens: string[]): Promise<void> {
  const type = tokens[2] as ProviderType | undefined;
  const provider = type ? await manager.selectProvider(type) : manager.getProvider();

  if (!provider) {
    console.log(colors.error('No provider selected. Run: graphyn provider set <type>'));
    process.exitCode = 1;
    return;
  }

  console.log(colors.bold(`\n  Testing ${provider.info.name}...\n`));

  const health = await provider.healthCheck();
  if (!health.healthy) {
    console.log(colors.error(`  Failed: ${health.error}`));
    process.exitCode = 1;
    return;
  }

  console.log(colors.success(`  Model: ${health.model}`));

  const startTime = Date.now();
  const response = await provider.chat([{ role: 'user', content: 'Say "Graphyn is ready" in exactly 3 words.' }]);
  const duration = Date.now() - startTime;

  console.log(colors.success(`  Response: ${response.result}`));
  console.log(colors.info(`  Time: ${duration}ms`));
  if (response.usage) {
    console.log(colors.info(`  Tokens: ${response.usage.inputTokens} in / ${response.usage.outputTokens} out`));
  }
  console.log('');
}

async function statusCommand(manager: ProviderManager): Promise<void> {
  const selected = manager.getSelectedProvider();
  if (!selected) {
    console.log(colors.warning('  No provider selected. Run: graphyn provider set <type>\n'));
    return;
  }

  const health = await manager.healthCheck();
  console.log(colors.bold('\n  Provider Status\n'));
  console.log(`  Active: ${colors.bold(health.type)}`);
  if (health.healthy) {
    console.log(colors.success(`  Status: Healthy (${health.model})`));
  } else {
    console.log(colors.error(`  Status: ${health.error}`));
  }
  console.log('');
}

function showProviderHelp(): void {
  console.log(`
${colors.bold('Graphyn Provider — AI Model Selection')}

${colors.highlight('Usage:')}
  graphyn provider <command> [options]

${colors.highlight('Commands:')}
  list, ls              List available providers
  set <type>            Select a provider (gemini, lmstudio, claude-cli)
  test [type]           Test provider connectivity
  status                Show current provider status

${colors.highlight('Examples:')}
  graphyn provider set gemini --key AIzaSy...
  graphyn provider set lmstudio --url http://localhost:1234/v1
  graphyn provider set claude-cli
  graphyn provider test gemini
`);
}
