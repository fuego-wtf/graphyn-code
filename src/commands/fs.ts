import { executeFsCommand } from '../vfs/service.js';
import { FsGlobalOptions } from '../vfs/types.js';
import { subjectHashFromInput } from '../vfs/policy.js';

interface ParsedFsInput {
  options: FsGlobalOptions;
  args: string[];
}

export async function runFsCommand(rawInput: string | string[]): Promise<void> {
  const parsed = parseFsInput(rawInput);
  const result = await executeFsCommand(parsed.args, parsed.options);
  console.log(JSON.stringify(result.envelope, null, 2));
  process.exitCode = result.exitCode;
}

function parseFsInput(rawInput: string | string[]): ParsedFsInput {
  const tokens = Array.isArray(rawInput)
    ? rawInput
    : rawInput.trim().split(/\s+/).filter(Boolean);
  if (tokens[0] !== 'fs') {
    throw new Error('fs command must start with `fs`');
  }

  const args: string[] = [];
  let grantId = process.env.GRAPHYN_VFS_GRANT_ID;
  let workspaceId = process.env.GRAPHYN_WORKSPACE_ID || 'local';
  let threadId = process.env.GRAPHYN_THREAD_ID || 'thread_local';
  let sessionId = process.env.GRAPHYN_SESSION_ID || 'session_local';
  let agentId = process.env.GRAPHYN_AGENT_ID || 'agent_local';
  let subject = process.env.GRAPHYN_SUBJECT || 'local-operator';

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === '--grant-id') {
      grantId = requireValue(tokens, i, token);
      i += 1;
    } else if (token === '--workspace-id') {
      workspaceId = requireValue(tokens, i, token);
      i += 1;
    } else if (token === '--thread-id') {
      threadId = requireValue(tokens, i, token);
      i += 1;
    } else if (token === '--session-id') {
      sessionId = requireValue(tokens, i, token);
      i += 1;
    } else if (token === '--agent-id') {
      agentId = requireValue(tokens, i, token);
      i += 1;
    } else if (token === '--subject') {
      subject = requireValue(tokens, i, token);
      i += 1;
    } else {
      args.push(token);
    }
  }

  return {
    args,
    options: {
      grantId,
      workspaceId,
      threadId,
      sessionId,
      agentId,
      subjectHash: subjectHashFromInput(subject),
    },
  };
}

function requireValue(tokens: string[], index: number, flag: string): string {
  const value = tokens[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}
