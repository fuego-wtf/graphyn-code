#!/usr/bin/env node
/**
 * graphyn env — Secure environment variable management for Fuego Labs
 *
 * Subcommands:
 *   graphyn env check                     Audit local .env files for validity and placeholders
 *   graphyn env list                      Show which services have env files
 *   graphyn env setup                     Copy .env.example → .env for registered env targets
 *
 * Current secret handoff:
 *   - Encrypted files live in .skills/fuegolabs-onboarding/secrets/
 *   - The team passphrase stays out of git
 *   - API-backed push/fetch routes are not implemented
 */

import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import {
  envTargetsByName,
  findWorkspaceRoot,
  loadGraphynConfig,
  resolveEnvPath,
  resolveExamplePath,
  resolveRepoRoot,
  type EnvTarget,
} from '../config/graphyn-config.js';

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray,
  highlight: chalk.cyan,
  bold: chalk.bold,
  dim: chalk.dim,
};

interface EnvFileAudit {
  assignmentCount: number;
  placeholderCount: number;
  invalidReason?: string;
}

const ENV_ASSIGNMENT_RE = /^(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=/;
const PLACEHOLDER_RE = /(?:your-|replace_with|REPLACE_|sk_test_your|pk_test_your|whsec_your|gph_sk_your|your_|_here$)/i;

// ─── Path Helpers ──────────────────────────────────────────────────

function loadServices(): Record<string, EnvTarget> {
  return envTargetsByName(loadGraphynConfig(findWorkspaceRoot()));
}

function containsNonTextBytes(content: Buffer): boolean {
  for (const byte of content) {
    if (byte === 9 || byte === 10 || byte === 13) continue;
    if (byte >= 32 && byte <= 126) continue;
    return true;
  }
  return false;
}

function auditEnvContent(content: Buffer): EnvFileAudit {
  if (content.length === 0) {
    return { assignmentCount: 0, placeholderCount: 0, invalidReason: 'empty file' };
  }
  if (containsNonTextBytes(content)) {
    return { assignmentCount: 0, placeholderCount: 0, invalidReason: 'binary or non-text bytes' };
  }

  const text = content.toString('utf8');
  if (text.includes('\uFFFD')) {
    return { assignmentCount: 0, placeholderCount: 0, invalidReason: 'invalid UTF-8' };
  }

  const lines = text.split(/\r?\n/).filter(line => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith('#');
  });
  const assignmentLines = lines.filter(line => ENV_ASSIGNMENT_RE.test(line.trim()));
  const placeholderCount = assignmentLines.filter(line => PLACEHOLDER_RE.test(line)).length;

  if (assignmentLines.length === 0) {
    return { assignmentCount: 0, placeholderCount, invalidReason: 'no KEY=value assignments' };
  }

  return { assignmentCount: assignmentLines.length, placeholderCount };
}

function auditEnvFile(filePath: string): EnvFileAudit {
  try {
    return auditEnvContent(fs.readFileSync(filePath));
  } catch {
    return { assignmentCount: 0, placeholderCount: 0, invalidReason: 'unreadable file' };
  }
}

// ─── Subcommands ───────────────────────────────────────────────────

/**
 * graphyn env setup — Copy .env.example → .env for registered env targets
 */
async function setupCommand(serviceFilter?: string, dryRun = false): Promise<void> {
  const root = findWorkspaceRoot();
  const services = loadServices();
  const targets = serviceFilter
    ? { [serviceFilter]: services[serviceFilter] }
    : services;

  if (serviceFilter && !services[serviceFilter]) {
    console.log(colors.error(`Unknown service: ${serviceFilter}`));
    console.log(colors.info(`Available: ${Object.keys(services).join(', ')}`));
    process.exitCode = 1;
    return;
  }

  console.log(colors.bold('\n  Fuego Labs — Environment Setup\n'));

  let created = 0;
  let skipped = 0;
  let existed = 0;

  for (const [, svc] of Object.entries(targets)) {
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

    if (dryRun) {
      console.log(colors.highlight(`  DRY   ${svc.label} — would create ${path.relative(root, dest)}`));
      skipped++;
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
 * graphyn env check — Audit .env files for validity and placeholders
 */
async function checkCommand(serviceFilter?: string): Promise<void> {
  const root = findWorkspaceRoot();
  const services = loadServices();
  const targets: Record<string, EnvTarget> = serviceFilter
    ? { [serviceFilter]: services[serviceFilter] }
    : services;

  if (serviceFilter && !services[serviceFilter]) {
    console.log(colors.error(`Unknown service: ${serviceFilter}`));
    console.log(colors.info(`Available: ${Object.keys(services).join(', ')}`));
    process.exitCode = 1;
    return;
  }

  console.log(colors.bold('\n  Fuego Labs — Environment Audit\n'));

  let ready = 0;
  let missing = 0;
  let placeholders = 0;
  let invalid = 0;

  for (const [_name, svc] of Object.entries(targets)) {
    const repoRoot = resolveRepoRoot(svc, root);
    if (!repoRoot) continue;

    const dest = resolveEnvPath(svc, repoRoot);

    if (!fs.existsSync(dest)) {
      console.log(colors.error(`  MISSING  ${svc.label}`));
      missing++;
      continue;
    }

    const audit = auditEnvFile(dest);

    if (audit.invalidReason) {
      console.log(colors.error(`  INVALID  ${svc.label} — ${audit.invalidReason}`));
      invalid++;
    } else if (audit.placeholderCount > 0) {
      console.log(colors.warning(`  ${audit.placeholderCount} placeholder(s)  ${svc.label}`));
      placeholders++;
    } else {
      console.log(colors.success(`  READY  ${svc.label} — ${audit.assignmentCount} assignment(s)`));
      ready++;
    }
  }

  console.log('');
  console.log(colors.dim(`  ${ready} ready, ${placeholders} have placeholders, ${missing} missing, ${invalid} invalid`));

  if (missing > 0 || placeholders > 0 || invalid > 0) {
    console.log('');
    console.log(colors.info('  Decrypt the encrypted files from ') + colors.highlight('.skills/fuegolabs-onboarding/secrets/') + colors.info(' or ask the team lead for missing values.'));
    process.exitCode = 1;
  }
  console.log('');
}

/**
 * graphyn env list — Show which services have env files
 */
async function listCommand(): Promise<void> {
  const root = findWorkspaceRoot();
  const services = loadServices();

  console.log(colors.bold('\n  Fuego Labs — Environment Services\n'));

  const rows: string[][] = [];
  for (const [name, svc] of Object.entries(services)) {
    const repoRoot = resolveRepoRoot(svc, root);
    if (!repoRoot) {
      rows.push([name, colors.dim('not found'), svc.repo, '—']);
      continue;
    }

    const dest = resolveEnvPath(svc, repoRoot);
    const example = resolveExamplePath(svc, repoRoot);
    const hasEnv = fs.existsSync(dest);
    const hasExample = fs.existsSync(example);

    const audit = hasEnv ? auditEnvFile(dest) : undefined;
    const status = hasEnv
      ? audit?.invalidReason
        ? colors.error('invalid')
        : colors.success('exists')
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
  const services = loadServices();
  console.log(`
${colors.bold('Graphyn Env — Secure Environment Variable Management')}

${colors.highlight('Usage:')}
  graphyn env <command> [options]

${colors.highlight('Commands:')}
  setup [--service <name>]   Copy .env.example → .env for registered env targets
  setup --dry-run            Preview env setup without writing files
  check                      Audit .env files for validity and placeholders
  list                       Show which services have env files configured

${colors.highlight('Unavailable:')}
  fetch, pull                 API-backed env fetch route is not implemented
  push, upload                API-backed env push route is not implemented

${colors.highlight('Services:')}
  ${Object.keys(services).join(', ')}

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
  let dryRun = false;

  // Parse --service flag
  for (let i = 2; i < tokens.length; i++) {
    if (tokens[i] === '--service' && tokens[i + 1]) {
      serviceFilter = tokens[i + 1];
      i++;
    } else if (tokens[i] === '--dry-run') {
      dryRun = true;
    } else if (!tokens[i].startsWith('-') && !serviceFilter) {
      serviceFilter = tokens[i];
    }
  }

  switch (subcommand) {
    case 'setup':
      await setupCommand(serviceFilter, dryRun);
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
      await checkCommand(serviceFilter);
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
