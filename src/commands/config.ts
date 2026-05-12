#!/usr/bin/env node

import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import {
  billingTierByKey,
  findWorkspaceRoot,
  graphynConfigPath,
  loadGraphynConfig,
  resolveEnvTargets,
  type BillingTierKey,
  type ResolvedEnvTarget,
  type StripeMode,
  type StripeTierConfig,
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

interface CheckResult {
  ok: boolean;
  configPath: string;
  errors: string[];
  warnings: string[];
  envTargets: Array<{
    name: string;
    repo: string;
    exampleExists: boolean;
    envExists: boolean;
    envPath: string | null;
  }>;
  billing: {
    catalogVersion: string;
    tiers: BillingTierKey[];
    stripeWarnings: string[];
  };
}

interface StripeVerifyResult {
  ok: boolean;
  mode: StripeMode;
  errors: string[];
  warnings: string[];
  checked: Array<{
    tier: BillingTierKey;
    productId: string | null;
    monthlyPriceId: string | null;
    annualPriceId: string | null;
    productLivemode?: boolean;
    monthlyLivemode?: boolean;
    annualLivemode?: boolean;
    status: string;
  }>;
}

function hasFlag(tokens: string[], flag: string): boolean {
  return tokens.includes(flag);
}

function flagValue(tokens: string[], flag: string): string | undefined {
  const index = tokens.indexOf(flag);
  if (index === -1) return undefined;
  return tokens[index + 1];
}

function asJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function targetPathForDisplay(target: ResolvedEnvTarget, workspaceRoot: string): string | null {
  if (!target.resolvedEnvPath) return null;
  if (target.resolvedEnvPath.startsWith(workspaceRoot)) {
    return path.relative(workspaceRoot, target.resolvedEnvPath);
  }
  return target.resolvedEnvPath.replace(process.env.HOME ?? '', '$HOME');
}

function buildCheckResult(): CheckResult {
  const workspaceRoot = findWorkspaceRoot();
  const config = loadGraphynConfig(workspaceRoot);
  const targets = resolveEnvTargets(workspaceRoot);
  const errors: string[] = [];
  const warnings: string[] = [];
  const stripeWarnings: string[] = [];

  for (const target of targets) {
    if (!target.repoRoot) {
      warnings.push(`${target.name}: ${target.repo.toLowerCase()} repo not found`);
      continue;
    }
    if (target.resolvedExamplePath && !fs.existsSync(target.resolvedExamplePath)) {
      errors.push(`${target.name}: example file missing at ${target.examplePath}`);
    }
  }

  for (const mode of ['test', 'live'] satisfies StripeMode[]) {
    for (const tier of ['pro', 'pro_plus', 'max'] satisfies BillingTierKey[]) {
      const stripe = config.billing.stripe[mode][tier];
      if (!stripe.productId || !stripe.monthlyPriceId || !stripe.annualPriceId) {
        stripeWarnings.push(`${mode}.${tier}: incomplete Stripe IDs (${stripe.status})`);
      } else if (stripe.status !== 'ready') {
        stripeWarnings.push(`${mode}.${tier}: ${stripe.status}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    configPath: graphynConfigPath(workspaceRoot),
    errors,
    warnings,
    envTargets: targets.map((target) => ({
      name: target.name,
      repo: target.repo,
      exampleExists: Boolean(target.resolvedExamplePath && fs.existsSync(target.resolvedExamplePath)),
      envExists: Boolean(target.resolvedEnvPath && fs.existsSync(target.resolvedEnvPath)),
      envPath: targetPathForDisplay(target, workspaceRoot),
    })),
    billing: {
      catalogVersion: config.billing.catalogVersion,
      tiers: config.billing.tiers.map((tier) => tier.key),
      stripeWarnings,
    },
  };
}

function checkCommand(json: boolean): void {
  const result = buildCheckResult();
  if (json) {
    asJson(result);
  } else {
    console.log(colors.bold('\n  Graphyn Configuration Registry Check\n'));
    console.log(colors.info('  Manifest: ') + colors.highlight(result.configPath));
    for (const target of result.envTargets) {
      const status = target.exampleExists ? colors.success('example') : colors.error('missing example');
      const env = target.envExists ? colors.success('env exists') : colors.warning('env missing');
      console.log(`  ${target.name.padEnd(13)} ${status}  ${env}  ${colors.dim(target.envPath ?? '-')}`);
    }
    for (const warning of [...result.warnings, ...result.billing.stripeWarnings]) {
      console.log(colors.warning(`  WARN  ${warning}`));
    }
    for (const error of result.errors) {
      console.log(colors.error(`  ERR   ${error}`));
    }
    console.log('');
  }
  if (!result.ok) process.exitCode = 1;
}

function listCommand(json: boolean): void {
  const workspaceRoot = findWorkspaceRoot();
  const config = loadGraphynConfig(workspaceRoot);
  const tiers = billingTierByKey(config);
  const payload = {
    schemaVersion: config.schemaVersion,
    sourceOfTruth: config.sourceOfTruth,
    envTargets: resolveEnvTargets(workspaceRoot),
    billing: {
      catalogVersion: config.billing.catalogVersion,
      tiers,
      stripe: config.billing.stripe,
    },
    prvt: config.prvt,
  };

  if (json) {
    asJson(payload);
    return;
  }

  console.log(colors.bold('\n  Graphyn Configuration Registry\n'));
  console.log(colors.info('  Source: ') + colors.highlight(config.sourceOfTruth ?? 'unknown'));
  console.log(colors.info('  Billing: ') + colors.highlight(config.billing.catalogVersion));
  console.log('');
  console.log(colors.bold('  Env targets'));
  for (const target of payload.envTargets) {
    console.log(`  ${target.name.padEnd(13)} ${target.repo.toLowerCase().padEnd(9)} ${colors.dim(target.envPath)}`);
  }
  console.log('');
  console.log(colors.bold('  Billing tiers'));
  for (const tier of config.billing.tiers) {
    console.log(`  ${tier.key.padEnd(9)} ${tier.displayName.padEnd(8)} $${tier.monthlyAmountUsd}/mo  $${tier.annualAmountUsd}/yr`);
  }
  console.log('');
}

function envTargetsCommand(json: boolean): void {
  const workspaceRoot = findWorkspaceRoot();
  const targets = resolveEnvTargets(workspaceRoot).map((target) => ({
    ...target,
    resolvedExamplePath: target.resolvedExamplePath,
    resolvedEnvPath: target.resolvedEnvPath,
  }));
  if (json) {
    asJson({ targets });
    return;
  }
  for (const target of targets) {
    console.log(`${target.name}\t${target.repo}\t${target.resolvedEnvPath ?? ''}`);
  }
}

async function stripeGet(pathname: string, apiKey: string): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const response = await fetch(`https://api.stripe.com/v1/${pathname}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  return { ok: response.ok, status: response.status, body };
}

async function verifyStripeTier(
  mode: StripeMode,
  tier: BillingTierKey,
  stripe: StripeTierConfig,
  apiKey: string,
): Promise<StripeVerifyResult['checked'][number] & { errors: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const expectedLivemode = mode === 'live';
  const checked: StripeVerifyResult['checked'][number] = {
    tier,
    productId: stripe.productId,
    monthlyPriceId: stripe.monthlyPriceId,
    annualPriceId: stripe.annualPriceId,
    status: stripe.status,
  };

  if (!stripe.productId || !stripe.monthlyPriceId || !stripe.annualPriceId) {
    warnings.push(`${mode}.${tier}: missing product or price id (${stripe.status})`);
    return { ...checked, errors, warnings };
  }

  const product = await stripeGet(`products/${stripe.productId}`, apiKey);
  if (!product.ok) {
    errors.push(`${mode}.${tier}: product ${stripe.productId} read failed (${product.status}) ${String((product.body.error as { message?: string } | undefined)?.message ?? '')}`);
  } else {
    checked.productLivemode = Boolean(product.body.livemode);
    if (checked.productLivemode !== expectedLivemode) {
      errors.push(`${mode}.${tier}: product livemode=${checked.productLivemode}, expected ${expectedLivemode}`);
    }
  }

  for (const interval of ['monthly', 'annual'] as const) {
    const priceId = interval === 'monthly' ? stripe.monthlyPriceId : stripe.annualPriceId;
    const price = await stripeGet(`prices/${priceId}`, apiKey);
    if (!price.ok) {
      errors.push(`${mode}.${tier}: ${interval} price ${priceId} read failed (${price.status}) ${String((price.body.error as { message?: string } | undefined)?.message ?? '')}`);
      continue;
    }
    const livemode = Boolean(price.body.livemode);
    if (interval === 'monthly') checked.monthlyLivemode = livemode;
    if (interval === 'annual') checked.annualLivemode = livemode;
    if (livemode !== expectedLivemode) {
      errors.push(`${mode}.${tier}: ${interval} livemode=${livemode}, expected ${expectedLivemode}`);
    }
    if (price.body.product !== stripe.productId) {
      warnings.push(`${mode}.${tier}: ${interval} price belongs to ${String(price.body.product)}, expected ${stripe.productId}`);
    }
  }

  if (stripe.status !== 'ready') {
    warnings.push(`${mode}.${tier}: ${stripe.status}`);
  }

  return { ...checked, errors, warnings };
}

async function stripeVerifyCommand(tokens: string[], json: boolean): Promise<void> {
  const modeValue = flagValue(tokens, '--mode') ?? 'test';
  if (modeValue !== 'test' && modeValue !== 'live') {
    console.log(colors.error(`Invalid --mode: ${modeValue}`));
    process.exitCode = 1;
    return;
  }

  const apiKey = process.env.STRIPE_SECRET_KEY ?? process.env.ID_STRIPE_SECRET_KEY;
  if (!apiKey) {
    const result: StripeVerifyResult = {
      ok: false,
      mode: modeValue,
      errors: ['Missing STRIPE_SECRET_KEY or ID_STRIPE_SECRET_KEY for read-only Stripe verification'],
      warnings: [],
      checked: [],
    };
    json ? asJson(result) : console.log(colors.error(`\n  ${result.errors[0]}\n`));
    process.exitCode = 1;
    return;
  }

  const config = loadGraphynConfig();
  const result: StripeVerifyResult = {
    ok: true,
    mode: modeValue,
    errors: [],
    warnings: [],
    checked: [],
  };

  for (const tier of ['pro', 'pro_plus', 'max'] satisfies BillingTierKey[]) {
    const tierResult = await verifyStripeTier(modeValue, tier, config.billing.stripe[modeValue][tier], apiKey);
    result.checked.push({
      tier: tierResult.tier,
      productId: tierResult.productId,
      monthlyPriceId: tierResult.monthlyPriceId,
      annualPriceId: tierResult.annualPriceId,
      productLivemode: tierResult.productLivemode,
      monthlyLivemode: tierResult.monthlyLivemode,
      annualLivemode: tierResult.annualLivemode,
      status: tierResult.status,
    });
    result.errors.push(...tierResult.errors);
    result.warnings.push(...tierResult.warnings);
  }

  result.ok = result.errors.length === 0;
  if (json) {
    asJson(result);
  } else {
    console.log(colors.bold(`\n  Stripe ${modeValue.toUpperCase()} Catalog Verification\n`));
    for (const checked of result.checked) {
      console.log(`  ${checked.tier.padEnd(9)} ${checked.productId ?? '-'}  ${colors.dim(checked.status)}`);
    }
    for (const warning of result.warnings) console.log(colors.warning(`  WARN  ${warning}`));
    for (const error of result.errors) console.log(colors.error(`  ERR   ${error}`));
    console.log('');
  }
  if (!result.ok) process.exitCode = 1;
}

function showHelp(): void {
  console.log(`
${colors.bold('Graphyn Config — Non-secret configuration registry')}

${colors.highlight('Usage:')}
  graphyn config <command> [options]

${colors.highlight('Commands:')}
  check [--json]                    Validate registry shape and local file targets
  list [--json]                     Show registry summary
  env-targets [--json]              Emit env target records for scripts
  stripe verify --mode test|live    Read-only Stripe product/price verification

${colors.highlight('Security:')}
  The registry stores references and public Stripe IDs only. Secret-looking values fail validation.
`);
}

export async function runConfigCommand(rawQuery: string): Promise<void> {
  const tokens = rawQuery.split(/\s+/).filter(Boolean);
  const subcommand = tokens[1] || '';
  const json = hasFlag(tokens, '--json');

  switch (subcommand) {
    case 'check':
    case 'audit':
      checkCommand(json);
      break;
    case 'list':
    case 'ls':
      listCommand(json);
      break;
    case 'env-targets':
      envTargetsCommand(json);
      break;
    case 'stripe':
      if (tokens[2] === 'verify') {
        await stripeVerifyCommand(tokens, json);
      } else {
        showHelp();
        process.exitCode = 1;
      }
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
