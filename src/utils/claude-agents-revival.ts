import fs from 'fs';
import path from 'path';
import os from 'os';

export interface DetectedAgent {
  source: 'project' | 'home';
  filePath: string;
  name: string;
  slug: string;
  description?: string;
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\-\s_]+/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseFrontmatter(content: string): { name?: string; description?: string } {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('---')) return {};
  const end = trimmed.indexOf('\n---', 3);
  if (end === -1) return {};
  const block = trimmed.slice(3, end).trim();
  const lines = block.split(/\r?\n/);
  const result: { name?: string; description?: string } = {};
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key === 'name') result.name = value.replace(/^"|"$/g, '');
    if (key === 'description') result.description = value.replace(/^"|"$/g, '');
  }
  return result;
}

function findAgentsInDir(dir: string, source: 'project' | 'home'): DetectedAgent[] {
  const agentsDir = path.join(dir, '.claude', 'agents');
  if (!fs.existsSync(agentsDir) || !fs.statSync(agentsDir).isDirectory()) return [];
  const entries = fs.readdirSync(agentsDir);
  const agents: DetectedAgent[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;
    const filePath = path.join(agentsDir, entry);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const fm = parseFrontmatter(content);
      const base = path.basename(entry, '.md');
      const name = fm.name || base;
      const slug = toSlug(name || base) || base;
      agents.push({ source, filePath, name, slug, description: fm.description });
    } catch {
      // skip unreadable files
    }
  }
  return agents;
}

export function detectClaudeAgents(projectPath: string = process.cwd()): DetectedAgent[] {
  const projectAgents = findAgentsInDir(projectPath, 'project');
  const home = os.homedir();
  const homeAgents = findAgentsInDir(home, 'home');
  // Deduplicate by slug, preferring project over home
  const seen = new Set<string>();
  const result: DetectedAgent[] = [];
  for (const agent of [...projectAgents, ...homeAgents]) {
    if (seen.has(agent.slug)) continue;
    seen.add(agent.slug);
    result.push(agent);
  }
  return result;
}

export function reviveAgents(agents: DetectedAgent[], projectPath: string = process.cwd()): { imported: number; targetDir: string } {
  const promptsDir = path.join(projectPath, 'prompts');
  if (!fs.existsSync(promptsDir)) {
    fs.mkdirSync(promptsDir, { recursive: true });
  }

  let imported = 0;
  for (const agent of agents) {
    const target = path.join(promptsDir, `${agent.slug}.md`);
    try {
      // If a prompt already exists, skip to avoid overwriting local changes
      if (fs.existsSync(target)) continue;
      fs.copyFileSync(agent.filePath, target);
      imported++;
    } catch {
      // ignore copy failures for now
    }
  }

  return { imported, targetDir: promptsDir };
}

