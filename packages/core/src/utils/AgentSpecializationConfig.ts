import fs from 'fs/promises';
import path from 'path';

export interface AgentSpecialization {
  name: string;
  description: string;
  defaultTools: string[];
  tags?: string[];
  prompt?: string;
}

export type AgentSpecializationMap = Record<string, AgentSpecialization>;

export interface AgentSpecializationLoadResult {
  configPath: string;
  agents: AgentSpecializationMap;
}

export async function loadAgentSpecializations(
  options: { cwd?: string; filename?: string } = {}
): Promise<AgentSpecializationLoadResult> {
  const cwd = options.cwd ?? process.cwd();
  const filename = options.filename ?? 'config/agent-specializations.json';
  const configPath = path.isAbsolute(filename) ? filename : path.join(cwd, filename);

  try {
    const raw = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const agents = extractAgentMap(parsed, configPath);
    validateAgentSpecializations(agents, configPath);
    return { configPath, agents };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Agent specialization config not found at ${configPath}`);
    }
    throw new Error(`Failed to load agent specializations from ${configPath}: ${(error as Error).message}`);
  }
}

function extractAgentMap(raw: any, configPath: string): AgentSpecializationMap {
  if (raw && typeof raw === 'object') {
    if (raw.agentTypes && typeof raw.agentTypes === 'object') {
      return raw.agentTypes as AgentSpecializationMap;
    }
  }
  return raw as AgentSpecializationMap;
}

function validateAgentSpecializations(map: AgentSpecializationMap, configPath: string): void {
  const entries = Object.entries(map);
  if (entries.length === 0) {
    throw new Error(`Agent specialization config ${configPath} is empty.`);
  }

  for (const [agentId, spec] of entries) {
    if (!spec || typeof spec !== 'object') {
      throw new Error(`Agent specialization ${agentId} must be an object in ${configPath}.`);
    }
    if (!spec.name || typeof spec.name !== 'string') {
      throw new Error(`Agent specialization ${agentId} is missing a name.`);
    }
    if (!spec.description || typeof spec.description !== 'string') {
      throw new Error(`Agent specialization ${agentId} is missing a description.`);
    }
    if (!Array.isArray(spec.defaultTools)) {
      throw new Error(`Agent specialization ${agentId} must define defaultTools as an array.`);
    }
  }
}
