/**
 * Upsell Prompt Component
 *
 * Displays a promotional prompt to upgrade to Graphyn Desktop
 * when the CLI detects Desktop is not installed.
 */

import { getDesktopDownloadUrl, getDesktopFeatures, isDesktopInstalled } from '../utils/desktop-bridge.js';

export interface UpsellOptions {
  /** Force show even if recently dismissed */
  force?: boolean;
  /** Context for why upsell is being shown */
  context?: 'search' | 'session' | 'knowledge' | 'general';
  /** Compact display mode */
  compact?: boolean;
}

// Track when upsell was last shown to avoid spam
let lastUpsellShown: number = 0;
const UPSELL_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Show upsell prompt if Desktop is not installed
 * Returns true if upsell was shown
 */
export async function showUpsellIfNeeded(options: UpsellOptions = {}): Promise<boolean> {
  const { force = false, context = 'general', compact = false } = options;

  // Check if Desktop is already installed
  if (await isDesktopInstalled()) {
    return false;
  }

  // Check cooldown unless forced
  const now = Date.now();
  if (!force && lastUpsellShown > 0 && (now - lastUpsellShown) < UPSELL_COOLDOWN_MS) {
    return false;
  }

  // Show the prompt
  if (compact) {
    showCompactUpsell(context);
  } else {
    showFullUpsell(context);
  }

  lastUpsellShown = now;
  return true;
}

/**
 * Show full upsell prompt with all features
 */
function showFullUpsell(context: string): void {
  const downloadUrl = getDesktopDownloadUrl();
  const features = getDesktopFeatures();

  const contextMessages: Record<string, string> = {
    search: 'Searching without a knowledge base? Desktop provides semantic code search!',
    session: 'Session memory allows you to pick up where you left off.',
    knowledge: 'Pre-indexed documentation for instant answers.',
    general: 'Supercharge your development workflow!'
  };

  console.log();
  console.log('\x1b[36m┌─────────────────────────────────────────────────────────────────┐\x1b[0m');
  console.log('\x1b[36m│\x1b[0m  \x1b[1m\x1b[33m🚀 Supercharge Your Development\x1b[0m                                \x1b[36m│\x1b[0m');
  console.log('\x1b[36m├─────────────────────────────────────────────────────────────────┤\x1b[0m');
  console.log('\x1b[36m│\x1b[0m                                                                 \x1b[36m│\x1b[0m');
  console.log(`\x1b[36m│\x1b[0m  \x1b[2m${contextMessages[context] || contextMessages.general}\x1b[0m`);
  console.log('\x1b[36m│\x1b[0m                                                                 \x1b[36m│\x1b[0m');
  console.log('\x1b[36m│\x1b[0m  \x1b[1mGraphyn Desktop provides:\x1b[0m                                     \x1b[36m│\x1b[0m');

  features.forEach((feature, i) => {
    const icon = ['📚', '🧠', '⚡', '📖', '🤖', '🎨'][i] || '•';
    const line = `  ${icon} ${feature}`;
    const padding = 65 - line.length;
    console.log(`\x1b[36m│\x1b[0m${line}${' '.repeat(Math.max(0, padding))}\x1b[36m│\x1b[0m`);
  });

  console.log('\x1b[36m│\x1b[0m                                                                 \x1b[36m│\x1b[0m');
  console.log(`\x1b[36m│\x1b[0m  \x1b[1m\x1b[32m[Download Free]\x1b[0m ${downloadUrl}                     \x1b[36m│\x1b[0m`);
  console.log('\x1b[36m│\x1b[0m                                                                 \x1b[36m│\x1b[0m');
  console.log('\x1b[36m└─────────────────────────────────────────────────────────────────┘\x1b[0m');
  console.log();
}

/**
 * Show compact single-line upsell
 */
function showCompactUpsell(context: string): void {
  const downloadUrl = getDesktopDownloadUrl();

  const messages: Record<string, string> = {
    search: '💡 Tip: Install Graphyn Desktop for semantic code search',
    session: '💡 Tip: Install Graphyn Desktop to save session memory',
    knowledge: '💡 Tip: Install Graphyn Desktop for offline docs',
    general: '💡 Tip: Install Graphyn Desktop for enhanced features'
  };

  console.log();
  console.log(`\x1b[33m${messages[context] || messages.general}\x1b[0m`);
  console.log(`\x1b[2m   → ${downloadUrl}\x1b[0m`);
  console.log();
}

/**
 * Show upsell prompt immediately (bypasses cooldown)
 */
export async function forceShowUpsell(compact: boolean = false): Promise<void> {
  await showUpsellIfNeeded({ force: true, compact });
}

/**
 * Reset upsell cooldown (for testing)
 */
export function resetUpsellCooldown(): void {
  lastUpsellShown = 0;
}

/**
 * Get upsell message as string (for integration with other UI systems)
 */
export function getUpsellMessage(context: string = 'general'): string {
  const downloadUrl = getDesktopDownloadUrl();
  const features = getDesktopFeatures();

  return `
🚀 Supercharge Your Development with Graphyn Desktop

${features.map((f, i) => `  ${['📚', '🧠', '⚡', '📖', '🤖', '🎨'][i]} ${f}`).join('\n')}

Download free: ${downloadUrl}
`.trim();
}
