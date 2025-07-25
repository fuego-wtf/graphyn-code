import simpleGit from 'simple-git';
import fs from 'fs';
import path from 'path';

export interface RepositoryInfo {
  url?: string;
  branch?: string;
  hasFile: (filename: string) => boolean;
  readFile: (filename: string) => string | null;
}

export async function getRepositoryInfo(): Promise<RepositoryInfo | null> {
  try {
    const git = simpleGit();
    
    // Check if we're in a git repository
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      return null;
    }

    // Get remote URL
    const remotes = await git.getRemotes(true);
    const origin = remotes.find(r => r.name === 'origin');
    const url = origin?.refs?.fetch;

    // Get current branch
    const branch = await git.revparse(['--abbrev-ref', 'HEAD']);

    // Get repository root
    const root = await git.revparse(['--show-toplevel']);

    return {
      url,
      branch: branch.trim(),
      hasFile: (filename: string) => {
        try {
          const filePath = path.join(root.trim(), filename);
          return fs.existsSync(filePath);
        } catch {
          return false;
        }
      },
      readFile: (filename: string) => {
        try {
          const filePath = path.join(root.trim(), filename);
          return fs.readFileSync(filePath, 'utf8');
        } catch {
          return null;
        }
      }
    };
  } catch {
    return null;
  }
}