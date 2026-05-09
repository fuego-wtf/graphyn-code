#!/usr/bin/env node
/**
 * graphyn env — Secure environment variable management for Fuego Labs
 *
 * Subcommands:
 *   graphyn env check                     Audit local .env files for placeholder values
 *   graphyn env list                      Show which services have env files
 *   graphyn env setup                     Copy .env.example → .env for all services
 *
 * Current secret handoff:
 *   - Encrypted files live in .skills/fuegolabs-onboarding/secrets/
 *   - The team passphrase stays out of git
 *   - API-backed push/fetch routes are not implemented
 */

import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import os from 'os';

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray,
  highlight: chalk.cyan,
  bold: chalk.bold,
  dim: chalk.dim,
};

// ─── Service Registry ──────────────────────────────────────────────

interface ServiceDef {
  label: string;
  examplePath: string;
  envPath: string;
  repo: 'WORKSPACE' | 'COMPOUND';
}

const SERVICES: Record<string, ServiceDef> = {
  vault:       { label: 'vault',       examplePath: 'vault/.env.example',                        envPath: 'vault/.env',                        repo: 'WORKSPACE' },
  web:         { label: 'web',         examplePath: 'web/.env.example',                          envPath: 'web/.env',                          repo: 'WORKSPACE' },
  'tbh-md':    { label: 'tbh-md',      examplePath: 'tbh-md/.env.example',                      envPath: 'tbh-md/.env',                       repo: 'WORKSPACE' },
  desktop:     { label: 'desktop',     examplePath: 'desktop/.env.example',                     envPath: 'desktop/.env.development',           repo: 'WORKSPACE' },
  id:          { label: 'id',          examplePath: 'id/.env.example',                          envPath: 'id/.env',                           repo: 'WORKSPACE' },
  'id-test':   { label: 'id-test',     examplePath: 'id/.env.test.example',                     envPath: 'id/.env.test.local',                repo: 'WORKSPACE' },
  code:        { label: 'code',        examplePath: 'code/.env.example',                        envPath: 'code/.env',                         repo: 'WORKSPACE' },
  mcp:         { label: 'mcp-server',  examplePath: 'backyard/mcp-server/.env.example',         envPath: 'backyard/mcp-server/.env',          repo: 'WORKSPACE' },
  mobile:      { label: 'mobile',      examplePath: 'mobile/.env.example',                      envPath: 'mobile/.env',                       repo: 'WORKSPACE' },
  buildfridays:{ label: 'buildfridays',examplePath: 'projects/buildfridays/.env.example',       envPath: 'projects/buildfridays/.env',        repo: 'COMPOUND' },
  prvt:        { label: 'prvt',        examplePath: 'projects/prvt/scripts/prvt.env.example',   envPath: 'PRVT_HOME_ENV',                     repo: 'COMPOUND' },
};

// ─── Path Helpers ──────────────────────────────────────────────────

function findWorkspaceRoot(): string {
  // Walk up from cwd to find the graphyn-workspace root
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'code', 'package.json')) &&
        fs.existsSync(path.join(dir, 'id', 'package.json'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: assume cwd is workspace root
  return process.cwd();
}

function resolveRepoRoot(service: ServiceDef, workspaceRoot: string): string | null {
  if (service.repo === 'COMPOUND') {
    const candidate = path.resolve(workspaceRoot, '..', 'compound');
    return fs.existsSync(candidate) ? candidate : null;
  }
  return workspaceRoot;
}

function resolveEnvPath(service: ServiceDef, repoRoot: string): string {
  if (service.envPath === 'PRVT_HOME_ENV') {
    return path.join(os.homedir(), '.prvt.env');
  }
  return path.join(repoRoot, service.envPath);
}

function resolveExamplePath(service: ServiceDef, repoRoot: string): string {
  return path.join(repoRoot, service.examplePath);
}

// ─── Subcommands ───────────────────────────────────────────────────

/**
 * graphyn env setup — Copy .env.example → .env for all services
 */
async function setupCommand(serviceFilter?: string): Promise<void> {
  const root = findWorkspaceRoot();
  const targets = serviceFilter
    ? { [serviceFilter]: SERVICES[serviceFilter] }
    : SERVICES;

  if (serviceFilter && !SERVICES[serviceFilter]) {
    console.log(colors.error(`Unknown service: ${serviceFilter}`));
    console.log(colors.info(`Available: ${Object.keys(SERVICES).join(', ')}`));
    process.exitCode = 1;
    return;
  }

  console.log(colors.bold('\n  Fuego Labs — Environment Setup\n'));

  let created = 0;
  let skipped = 0;
  let existed = 0;

  for (const [name, svc] of Object.entries(targets)) {
    const repoRoot = resolveRepoRoot(svc, root);
    if (!repoRoot) {
      console.log(colors.warning(`  SKIP  ${svc.label} — compound repo not found`));
      skipped++;
      continue;
    }

    const src = resolveExamplePath(svc, repoRoot);
    const dest = resolveEnvPath(svc, repoRoot);

    if (!fs.existsSync(src)) {
      console.log(colors.warning(`  SKIP  ${svc.label} — ${svc.examplePath} not found`));
      skipped++;
      continue;
    }

    if (fs.existsSync(dest)) {
      console.log(colors.info(`  OK    ${svc.label} — already exists`));
      existed++;
      continue;
    }

    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
    fs.chmodSync(dest, 0o600);
    console.log(colors.success(`  NEW   ${svc.label} — created ${path.relative(root, dest)}`));
    created++;
  }

  console.log('');
  console.log(colors.dim(`  ${created} created, ${existed} existed, ${skipped} skipped`));
  console.log('');
  console.log(colors.bold('  Next:'));
  console.log(colors.info('    Decrypt encrypted files from ') + colors.highlight('.skills/fuegolabs-onboarding/secrets/'));
  console.log(colors.highlight('    graphyn env check') + colors.info('  — audit for missing values'));
  console.log('');
}

/**
 * graphyn env check — Audit .env files for placeholder values
 */
async function checkCommand(): Promise<void> {
  const root = findWorkspaceRoot();
  const PLACEHOLDER_RE = /(?:your-|replace_with|REPLACE_|sk_test_your|pk_test_your|whsec_your|gph_sk_your|your_|_here$)/i;

  console.log(colors.bold('\n  Fuego Labs — Environment Audit\n'));

  let ready = 0;
  let missing = 0;
  let placeholders = 0;

  for (const [name, svc] of Object.entries(SERVICES)) {
    const repoRoot = resolveRepoRoot(svc, root);
    if (!repoRoot) continue;

    const dest = resolveEnvPath(svc, repoRoot);

    if (!fs.existsSync(dest)) {
      console.log(colors.error(`  MISSING  ${svc.label}`));
      missing++;
      continue;
    }

    const content = fs.readFileSync(dest, 'utf8');
    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    const placeholderLines = lines.filter(l => PLACEHOLDER_RE.test(l));

    if (placeholderLines.length > 0) {
      console.log(colors.warning(`  ${placeholderLines.length} placeholder(s)  ${svc.label}`));
      placeholders++;
    } else {
      console.log(colors.success(`  READY  ${svc.label}`));
      ready++;
    }
  }

  console.log('');
  console.log(colors.dim(`  ${ready} ready, ${placeholders} have placeholders, ${missing} missing`));

  if (missing > 0 || placeholders > 0) {
    console.log('');
    console.log(colors.info('  Decrypt the encrypted files from ') + colors.highlight('.skills/fuegolabs-onboarding/secrets/') + colors.info(' or ask the team lead for missing values.'));
  }
  console.log('');
}

/**
 * graphyn env list — Show which services have env files
 */
async function listCommand(): Promise<void> {
  const root = findWorkspaceRoot();

  console.log(colors.bold('\n  Fuego Labs — Environment Services\n'));

  const rows: string[][] = [];
  for (const [name, svc] of Object.entries(SERVICES)) {
    const repoRoot = resolveRepoRoot(svc, root);
    if (!repoRoot) {
      rows.push([name, colors.dim('not found'), svc.repo, '—']);
      continue;
    }

    const dest = resolveEnvPath(svc, repoRoot);
    const example = resolveExamplePath(svc, repoRoot);
    const hasEnv = fs.existsSync(dest);
    const hasExample = fs.existsSync(example);

    const status = hasEnv
      ? colors.success('exists')
      : hasExample
        ? colors.warning('example only')
        : colors.dim('none');

    rows.push([name, status, svc.repo.toLowerCase(), path.relative(root, dest)]);
  }

  const maxName = Math.max(...rows.map(r => r[0].length));
  for (const [name, status, repo, envPath] of rows) {
    const padded = name.padEnd(maxName);
    console.log(`  ${padded}  ${status}  ${colors.dim(repo)}  ${colors.dim(envPath)}`);
  }
  console.log('');
}

function unavailableApiCommand(command: 'fetch' | 'push'): void {
  console.log(colors.bold(`\n  graphyn env ${command} is not available\n`));
  console.log(colors.warning(`  The /api/env/${command} backend route is not implemented.`));
  console.log(colors.info('  Current onboarding uses encrypted files in ') + colors.highlight('.skills/fuegolabs-onboarding/secrets/') + colors.info('.'));
  console.log(colors.info('  Use ') + colors.highlight('graphyn env setup') + colors.info(' to create templates, decrypt the skill files with the team passphrase, then run ') + colors.highlight('graphyn env check') + colors.info('.'));
  console.log('');
  process.exitCode = 1;
}

// ─── Help ──────────────────────────────────────────────────────────

function showHelp(): void {
  console.log(`
${colors.bold('Graphyn Env — Secure Environment Variable Management')}

${colors.highlight('Usage:')}
  graphyn env <command> [options]

${colors.highlight('Commands:')}
  setup [--service <name>]   Copy .env.example → .env for all services
  check                      Audit .env files for placeholder values
  list                       Show which services have env files configured

${colors.highlight('Unavailable:')}
  fetch, pull                 API-backed env fetch route is not implemented
  push, upload                API-backed env push route is not implemented

${colors.highlight('Services:')}
  ${Object.keys(SERVICES).join(', ')}

${colors.highlight('Workflow:')}
  ${colors.bold('Team Lead:')}
    1. Fill in your .env files with real values
    2. Run ${colors.highlight('./scripts/encrypt-to-skill.sh')} from the workspace root
    3. Commit ${colors.highlight('.skills/fuegolabs-onboarding/secrets/')}
    4. Share the team passphrase out-of-band

  ${colors.bold('New Teammate:')}
    1. Clone the repo
    2. Run ${colors.highlight('graphyn env setup')}
    3. Decrypt ${colors.highlight('.skills/fuegolabs-onboarding/secrets/*.env.enc')} with the team passphrase
    4. Run ${colors.highlight('graphyn env check')}

${colors.highlight('Security:')}
  - The team passphrase is never committed
  - Plaintext .env files stay local
  - .env files written with 600 permissions (owner-only)
`);
}

// ─── Command Router ────────────────────────────────────────────────

export async function runEnvCommand(rawQuery: string): Promise<void> {
  const tokens = rawQuery.split(/\s+/);
  // tokens[0] is "env"

  const subcommand = tokens[1] || '';
  let serviceFilter: string | undefined;

  // Parse --service flag
  for (let i = 2; i < tokens.length; i++) {
    if (tokens[i] === '--service' && tokens[i + 1]) {
      serviceFilter = tokens[i + 1];
      i++;
    }
  }

  switch (subcommand) {
    case 'setup':
      await setupCommand(serviceFilter);
      break;
    case 'fetch':
    case 'pull':
      unavailableApiCommand('fetch');
      break;
    case 'push':
    case 'upload':
      unavailableApiCommand('push');
      break;
    case 'check':
    case 'audit':
      await checkCommand();
      break;
    case 'list':
    case 'ls':
      await listCommand();
      break;
    case 'help':
    case '--help':
    case '-h':
    case '':
      showHelp();
      break;
    default:
      console.log(colors.error(`Unknown subcommand: ${subcommand}`));
      showHelp();
      process.exitCode = 1;
  }
}
