import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

export type RepoKey = 'WORKSPACE' | 'COMPOUND';
export type BillingTierKey = 'free' | 'pro' | 'pro_plus' | 'max';
export type StripeMode = 'test' | 'live';

export interface EnvTarget {
  name: string;
  label: string;
  repo: RepoKey;
  examplePath: string;
  envPath: string;
  encryptedName: string;
  owner: string;
}

export interface BillingTierConfig {
  key: BillingTierKey;
  displayName: string;
  monthlyAmountUsd: number;
  annualAmountUsd: number;
  trialDays: number;
  entitlementTier: 'desktop' | 'pro' | 'pro_plus' | 'max';
  limits: Record<string, number>;
  features: string[];
}

export interface StripeTierConfig {
  productId: string | null;
  monthlyPriceId: string | null;
  annualPriceId: string | null;
  status: string;
}

export interface GraphynConfig {
  schemaVersion: number;
  updatedAt?: string;
  sourceOfTruth?: string;
  envTargets: EnvTarget[];
  billing: {
    catalogVersion: string;
    tiers: BillingTierConfig[];
    legacyAliases: Record<string, BillingTierKey>;
    stripe: Record<StripeMode, Record<BillingTierKey, StripeTierConfig> & { retired?: Record<string, unknown> }>;
  };
  prvt: {
    repoPath: string;
    workerName: string;
    statusEndpoint: string;
    routeOriginKeys: string[];
    kvBindings: string[];
    secretRefs: string[];
  };
}

export interface ResolvedEnvTarget extends EnvTarget {
  repoRoot: string | null;
  resolvedExamplePath: string | null;
  resolvedEnvPath: string | null;
}

const CONFIG_RELATIVE_PATH = path.join('config', 'graphyn.config.json');
const SECRET_VALUE_PATTERNS = [
  /\bsk_(?:live|test)_[A-Za-z0-9_]+/,
  /\bpk_(?:live|test)_[A-Za-z0-9_]+/,
  /\bwhsec_[A-Za-z0-9_]+/,
  /\bgh[pousr]_[A-Za-z0-9_]+/,
  /\bxox[baprs]-[A-Za-z0-9-]+/,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----/,
];

let cachedConfig: GraphynConfig | null = null;
let cachedRoot: string | null = null;

export function findWorkspaceRoot(startDir = process.cwd()): string {
  const candidates = [
    startDir,
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..'),
  ];

  for (const candidate of candidates) {
    let dir = path.resolve(candidate);
    for (let i = 0; i < 12; i++) {
      if (
        fs.existsSync(path.join(dir, CONFIG_RELATIVE_PATH)) &&
        fs.existsSync(path.join(dir, 'code', 'package.json')) &&
        fs.existsSync(path.join(dir, 'id', 'package.json'))
      ) {
        return dir;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  return process.cwd();
}

export function graphynConfigPath(workspaceRoot = findWorkspaceRoot()): string {
  return path.join(workspaceRoot, CONFIG_RELATIVE_PATH);
}

export function loadGraphynConfig(workspaceRoot = findWorkspaceRoot()): GraphynConfig {
  if (cachedConfig && cachedRoot === workspaceRoot) return cachedConfig;

  const configPath = graphynConfigPath(workspaceRoot);
  const raw = fs.readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(raw) as GraphynConfig;
  validateConfigShape(parsed);
  assertNoSecretValues(parsed);

  cachedConfig = parsed;
  cachedRoot = workspaceRoot;
  return parsed;
}

export function envTargetsByName(config = loadGraphynConfig()): Record<string, EnvTarget> {
  return Object.fromEntries(config.envTargets.map((target) => [target.name, target]));
}

export function resolveRepoRoot(target: EnvTarget, workspaceRoot = findWorkspaceRoot()): string | null {
  if (target.repo === 'COMPOUND') {
    const candidate = path.resolve(workspaceRoot, '..', 'compound');
    return fs.existsSync(candidate) ? candidate : null;
  }
  return workspaceRoot;
}

export function resolveEnvPath(target: EnvTarget, repoRoot: string): string {
  if (target.envPath.startsWith('$HOME/')) {
    return path.join(os.homedir(), target.envPath.slice('$HOME/'.length));
  }
  return path.join(repoRoot, target.envPath);
}

export function resolveExamplePath(target: EnvTarget, repoRoot: string): string {
  return path.join(repoRoot, target.examplePath);
}

export function resolveEnvTargets(workspaceRoot = findWorkspaceRoot()): ResolvedEnvTarget[] {
  const config = loadGraphynConfig(workspaceRoot);
  return config.envTargets.map((target) => {
    const repoRoot = resolveRepoRoot(target, workspaceRoot);
    return {
      ...target,
      repoRoot,
      resolvedExamplePath: repoRoot ? resolveExamplePath(target, repoRoot) : null,
      resolvedEnvPath: repoRoot ? resolveEnvPath(target, repoRoot) : null,
    };
  });
}

export function billingTierByKey(config = loadGraphynConfig()): Record<BillingTierKey, BillingTierConfig> {
  return Object.fromEntries(config.billing.tiers.map((tier) => [tier.key, tier])) as Record<BillingTierKey, BillingTierConfig>;
}

function validateConfigShape(config: GraphynConfig): void {
  if (config.schemaVersion !== 1) {
    throw new Error(`Unsupported graphyn config schemaVersion: ${config.schemaVersion}`);
  }

  const names = new Set<string>();
  for (const target of config.envTargets) {
    if (names.has(target.name)) {
      throw new Error(`Duplicate env target: ${target.name}`);
    }
    names.add(target.name);
    if (target.repo !== 'WORKSPACE' && target.repo !== 'COMPOUND') {
      throw new Error(`Invalid repo for env target ${target.name}: ${target.repo}`);
    }
  }

  const tierKeys = new Set(config.billing.tiers.map((tier) => tier.key));
  for (const required of ['free', 'pro', 'pro_plus', 'max'] satisfies BillingTierKey[]) {
    if (!tierKeys.has(required)) {
      throw new Error(`Missing billing tier: ${required}`);
    }
  }
}

function assertNoSecretValues(value: unknown, trail = 'config'): void {
  if (typeof value === 'string') {
    for (const pattern of SECRET_VALUE_PATTERNS) {
      if (pattern.test(value)) {
        throw new Error(`Secret-looking value is not allowed in ${trail}`);
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecretValues(item, `${trail}[${index}]`));
    return;
  }

  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      assertNoSecretValues(nested, `${trail}.${key}`);
    }
  }
}
