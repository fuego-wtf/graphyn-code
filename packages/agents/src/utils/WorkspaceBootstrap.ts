import { promises as fs } from 'fs';
import path from 'path';

export interface WorkspaceBootstrapOptions {
  agentId: string;
  agentType: string;
  sessionId: string;
  baseDir: string;
  taskDescription: string;
  dependencies?: string[];
}

export async function bootstrapWorkspace(options: WorkspaceBootstrapOptions): Promise<string> {
  const agentDir = path.join(options.baseDir, options.agentId);
  await fs.mkdir(agentDir, { recursive: true });

  const directories = ['input', 'output', 'audits', 'temp'];
  await Promise.all(directories.map((dir) => fs.mkdir(path.join(agentDir, dir), { recursive: true })));

  const claudePath = path.join(agentDir, 'CLAUDE.md');
  await fs.writeFile(
    claudePath,
    `# Agent Context\n\n- Agent: ${options.agentId} (${options.agentType})\n- Session: ${options.sessionId}\n- Task: ${options.taskDescription}\n- Dependencies: ${(options.dependencies || []).join(', ') || 'None'}\n`
  );

  return agentDir;
}
