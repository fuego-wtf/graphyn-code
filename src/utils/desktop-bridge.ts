/**
 * Desktop Detection Bridge
 *
 * Detects Graphyn Desktop installation and connects to its knowledge base.
 * Used by @graphyn/code CLI to provide enhanced features when Desktop is available.
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as net from 'net';

export interface DesktopDetectionResult {
  installed: boolean;
  path?: string;
  version?: string;
  method?: 'app-bundle' | 'config-dir' | 'mcp-server';
}

export interface KnowledgeBaseConnection {
  connected: boolean;
  url: string;
  version?: string;
}

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, any>;
}

/**
 * Known installation paths for Graphyn Desktop across platforms
 */
function getDesktopPaths(): string[] {
  const platform = process.platform;
  const homeDir = os.homedir();
  const paths: string[] = [];

  switch (platform) {
    case 'darwin': // macOS
      paths.push(
        '/Applications/Graphyn.app',
        '/Applications/Graphyn Desktop.app',
        path.join(homeDir, 'Applications', 'Graphyn.app'),
        path.join(homeDir, 'Applications', 'Graphyn Desktop.app')
      );
      break;

    case 'win32': // Windows
      paths.push(
        'C:\\Program Files\\Graphyn\\Graphyn.exe',
        'C:\\Program Files\\Graphyn Desktop\\Graphyn Desktop.exe',
        path.join(homeDir, 'AppData', 'Local', 'Graphyn', 'Graphyn.exe'),
        path.join(homeDir, 'AppData', 'Local', 'Programs', 'Graphyn', 'Graphyn.exe')
      );
      break;

    case 'linux':
      paths.push(
        '/usr/bin/graphyn',
        '/usr/local/bin/graphyn',
        '/opt/graphyn/graphyn',
        path.join(homeDir, '.local', 'bin', 'graphyn'),
        path.join(homeDir, 'bin', 'graphyn'),
        // AppImage locations
        path.join(homeDir, 'Applications', 'Graphyn.AppImage'),
        path.join(homeDir, '.local', 'share', 'applications', 'graphyn.desktop')
      );
      break;
  }

  return paths;
}

/**
 * Check if Graphyn Desktop is installed
 */
export async function isDesktopInstalled(): Promise<boolean> {
  const result = await detectDesktop();
  return result.installed;
}

/**
 * Detect Graphyn Desktop installation with details
 */
export async function detectDesktop(): Promise<DesktopDetectionResult> {
  // Method 1: Check known installation paths
  const paths = getDesktopPaths();
  for (const appPath of paths) {
    if (fs.existsSync(appPath)) {
      return {
        installed: true,
        path: appPath,
        method: 'app-bundle'
      };
    }
  }

  // Method 2: Check for Graphyn config directory (indicates prior use)
  const graphynDir = path.join(os.homedir(), '.graphyn');
  const desktopConfig = path.join(graphynDir, 'desktop.json');
  if (fs.existsSync(desktopConfig)) {
    try {
      const config = JSON.parse(fs.readFileSync(desktopConfig, 'utf8'));
      if (config.installed && config.path && fs.existsSync(config.path)) {
        return {
          installed: true,
          path: config.path,
          version: config.version,
          method: 'config-dir'
        };
      }
    } catch {
      // Config exists but is invalid or app no longer installed
    }
  }

  // Method 3: Check if graphyn-base MCP server is running
  const mcpRunning = await isKnowledgeBaseRunning();
  if (mcpRunning) {
    return {
      installed: true,
      method: 'mcp-server'
    };
  }

  return { installed: false };
}

/**
 * Check if the graphyn-base MCP server is running (default port 9000)
 */
async function isKnowledgeBaseRunning(port: number = 9000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 1000;

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, 'localhost');
  });
}

/**
 * Get connection to Desktop's knowledge base (graphyn-base MCP server)
 */
export async function getDesktopKnowledgeBase(): Promise<KnowledgeBaseConnection | null> {
  const baseUrl = process.env.GRAPHYN_BASE_URL || 'http://localhost:9000';

  try {
    // Try to connect to the health endpoint
    const response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });

    if (response.ok) {
      const data = await response.json() as { version?: string };
      return {
        connected: true,
        url: baseUrl,
        version: data.version
      };
    }
  } catch {
    // Connection failed - Desktop KB not available
  }

  return null;
}

/**
 * Search the Desktop knowledge base
 * Returns null if Desktop is not installed or KB is not running
 */
export async function searchKnowledgeBase(
  query: string,
  options?: {
    limit?: number;
    docType?: string;
    threshold?: number;
  }
): Promise<SearchResult[] | null> {
  const kb = await getDesktopKnowledgeBase();
  if (!kb) {
    return null;
  }

  try {
    const params = new URLSearchParams({
      query,
      limit: String(options?.limit || 10),
      ...(options?.docType && { doc_type: options.docType }),
      ...(options?.threshold && { threshold: String(options.threshold) })
    });

    const response = await fetch(`${kb.url}/search?${params}`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      const results = await response.json() as SearchResult[];
      return results;
    }
  } catch {
    // Search failed
  }

  return null;
}

/**
 * Get Desktop download URL for current platform
 */
export function getDesktopDownloadUrl(): string {
  const platform = process.platform;
  const baseUrl = 'https://graphyn.xyz/download';

  switch (platform) {
    case 'darwin':
      return `${baseUrl}/mac`;
    case 'win32':
      return `${baseUrl}/windows`;
    case 'linux':
      return `${baseUrl}/linux`;
    default:
      return baseUrl;
  }
}

/**
 * Get Desktop features description for upsell
 */
export function getDesktopFeatures(): string[] {
  return [
    'Semantic code search across your entire codebase',
    'Session memory - never lose context between chats',
    'Offline knowledge base - works without API calls',
    'Pre-indexed docs for React, Tauri, Encore, TypeScript',
    'Multi-agent orchestration with persistent state',
    'Figma design synchronization'
  ];
}
