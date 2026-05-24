/**
 * CapabilityRouter — routes capability-domain requests to the correct adapter.
 *
 * Routing rule (from project doctrine + §10 of schedule-cli-design-v1.md):
 *   base/*          → packages/base Rust CLI (BaseCliAdapter — existing)
 *   external_mcp/*  → MCPBridge (narrowed post-cutover, non-base MCP only)
 *   schedule/*      → BackyardCliAdapter (THIS ROUTER)
 *   device/*        → BackyardCliAdapter (future)
 *   grant/*         → BackyardCliAdapter (future)
 *
 * New Graphyn-internal capability domains should register here with
 * `router.register('domain/*', new BackyardCliAdapter())` — never default to
 * MCPBridge or BaseCliAdapter for network REST capabilities.
 */

import {
  BackyardCliAdapter,
  type BackyardCapabilityRequest,
  type BackyardResult,
} from './backyard-cli-adapter.js';

// ─── Adapter interface ────────────────────────────────────────────────────────

/**
 * Minimal interface that every capability adapter must satisfy.
 * Keeps the router generic: it does not care about transport details.
 */
export interface CapabilityAdapter {
  invoke<T>(req: BackyardCapabilityRequest): Promise<BackyardResult<T>>;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export class CapabilityRouter {
  /** Map from domain prefix (e.g. "schedule") to adapter instance. */
  private readonly adapters = new Map<string, CapabilityAdapter>();

  /**
   * Register an adapter for a domain prefix.
   * @param domainPrefix  e.g. "schedule" (matches "schedule", "schedule/create", etc.)
   * @param adapter       adapter instance that will handle requests for this domain
   */
  register(domainPrefix: string, adapter: CapabilityAdapter): void {
    const normalized = domainPrefix.replace(/\/\*$/, '');
    this.adapters.set(normalized, adapter);
  }

  /**
   * Route a request to the registered adapter for its domain.
   * The `req.domain` field drives routing — e.g. "schedule/create".
   * Throws if no adapter is registered for the domain.
   */
  async invoke<T>(req: BackyardCapabilityRequest): Promise<BackyardResult<T>> {
    const prefix = req.domain.split('/')[0];
    const adapter = this.adapters.get(prefix ?? '');
    if (!adapter) {
      throw new Error(
        `CapabilityRouter: no adapter registered for domain "${req.domain}". ` +
          `Registered prefixes: ${[...this.adapters.keys()].join(', ') || '(none)'}`,
      );
    }
    return adapter.invoke<T>(req);
  }

  /** Convenience: list all registered domain prefixes. */
  registeredDomains(): string[] {
    return [...this.adapters.keys()];
  }
}

// ─── Singleton factory ────────────────────────────────────────────────────────

let _defaultRouter: CapabilityRouter | null = null;

/**
 * Returns (and lazily creates) the default CapabilityRouter with all
 * production-registered adapters wired up.
 *
 * Call sites should prefer this over constructing their own router so that
 * future domain registrations land automatically.
 */
export function getDefaultCapabilityRouter(): CapabilityRouter {
  if (_defaultRouter) return _defaultRouter;

  const router = new CapabilityRouter();
  const backyardAdapter = new BackyardCliAdapter();

  // schedule/* → BackyardCliAdapter
  router.register('schedule', backyardAdapter);

  // device/*, grant/* reserved for future backyard domains — same adapter
  router.register('device', backyardAdapter);
  router.register('grant', backyardAdapter);

  _defaultRouter = router;
  return _defaultRouter;
}

/** Reset the singleton (test use only). */
export function _resetDefaultRouter(): void {
  _defaultRouter = null;
}
