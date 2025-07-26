import { promises as fs } from 'fs';
import path from 'path';
import { simpleGit, SimpleGit } from 'simple-git';

export interface GitInfo {
  type: 'repository' | 'submodule' | 'worktree';
  path: string;
  gitDir: string;
  parentRepo?: string;
}

export interface SubmoduleInfo {
  name: string;
  path: string;
  url: string;
  branch?: string;
  commit: string;
}

export interface GitContext {
  type: 'repository' | 'submodule' | 'worktree' | 'none';
  root?: string;
  branch?: string;
  remotes?: Array<{ name: string; url: string }>;
  submodules?: SubmoduleInfo[];
  isClean?: boolean;
  lastCommit?: {
    hash: string;
    message: string;
    author: string;
    date: Date;
  };
  gitFlow?: {
    mainBranch: string;
    developBranch?: string;
    hasGitFlow: boolean;
  };
}

export class GitDetector {
  private git?: SimpleGit;
  
  async detect(startPath: string): Promise<GitContext> {
    const gitInfo = await this.findGitInfo(startPath);
    
    if (!gitInfo) {
      return { type: 'none' };
    }
    
    this.git = simpleGit(gitInfo.path);
    
    try {
      const [branch, remotes, status, log] = await Promise.all([
        this.getCurrentBranch(),
        this.getRemotes(),
        this.isClean(),
        this.getLastCommit()
      ]);
      
      const context: GitContext = {
        type: gitInfo.type,
        root: gitInfo.path,
        branch,
        remotes,
        isClean: status,
        lastCommit: log
      };
      
      // Check for submodules
      const submodules = await this.getSubmodules();
      if (submodules.length > 0) {
        context.submodules = submodules;
      }
      
      // Detect git flow
      context.gitFlow = await this.detectGitFlow();
      
      return context;
    } catch (error) {
      // Return basic info if detailed detection fails
      return {
        type: gitInfo.type,
        root: gitInfo.path
      };
    }
  }
  
  private async findGitInfo(startPath: string): Promise<GitInfo | null> {
    let currentPath = path.resolve(startPath);
    
    while (currentPath !== path.dirname(currentPath)) {
      const gitPath = path.join(currentPath, '.git');
      
      try {
        const stats = await fs.stat(gitPath);
        
        if (stats.isDirectory()) {
          // Regular git repository
          return {
            type: 'repository',
            path: currentPath,
            gitDir: gitPath
          };
        } else if (stats.isFile()) {
          // Submodule or worktree - read the git file
          const content = await fs.readFile(gitPath, 'utf8');
          const match = content.match(/^gitdir: (.+)$/m);
          
          if (match) {
            const gitDir = path.isAbsolute(match[1]) 
              ? match[1] 
              : path.resolve(currentPath, match[1]);
            
            // Determine if it's a submodule or worktree
            const type = gitDir.includes('.git/modules/') ? 'submodule' : 'worktree';
            
            return {
              type,
              path: currentPath,
              gitDir,
              parentRepo: type === 'submodule' ? await this.findParentRepo(gitDir) : undefined
            };
          }
        }
      } catch {
        // Continue searching up
      }
      
      currentPath = path.dirname(currentPath);
    }
    
    return null;
  }
  
  private async findParentRepo(gitDir: string): Promise<string | undefined> {
    // Extract parent repo from submodule git directory
    // Format: /path/to/parent/.git/modules/submodule-name
    const match = gitDir.match(/^(.+)\.git[\/\\]modules[\/\\]/);
    return match ? match[1] : undefined;
  }
  
  private async getCurrentBranch(): Promise<string | undefined> {
    try {
      const branch = await this.git!.branchLocal();
      return branch.current;
    } catch {
      return undefined;
    }
  }
  
  private async getRemotes(): Promise<Array<{ name: string; url: string }>> {
    try {
      const remotes = await this.git!.getRemotes(true);
      return remotes.map(r => ({ 
        name: r.name, 
        url: r.refs.fetch || r.refs.push || '' 
      }));
    } catch {
      return [];
    }
  }
  
  private async isClean(): Promise<boolean> {
    try {
      const status = await this.git!.status();
      return status.isClean();
    } catch {
      return true;
    }
  }
  
  private async getLastCommit(): Promise<GitContext['lastCommit'] | undefined> {
    try {
      const log = await this.git!.log({ maxCount: 1 });
      if (log.latest) {
        return {
          hash: log.latest.hash,
          message: log.latest.message,
          author: log.latest.author_name,
          date: new Date(log.latest.date)
        };
      }
    } catch {
      // Ignore errors
    }
    return undefined;
  }
  
  private async getSubmodules(): Promise<SubmoduleInfo[]> {
    try {
      const result = await this.git!.subModule(['status']);
      return this.parseSubmoduleStatus(result);
    } catch {
      return [];
    }
  }
  
  private parseSubmoduleStatus(output: string): SubmoduleInfo[] {
    const submodules: SubmoduleInfo[] = [];
    const lines = output.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      // Format: <commit> <path> (<branch/tag>)
      const match = line.match(/^([+\- ]?)([0-9a-f]+) ([^\s]+)(?: \((.+)\))?/);
      if (match) {
        submodules.push({
          name: match[3],
          path: match[3],
          commit: match[2],
          branch: match[4],
          url: '' // Would need to read .gitmodules for URL
        });
      }
    }
    
    return submodules;
  }
  
  private async detectGitFlow(): Promise<GitContext['gitFlow']> {
    try {
      const branches = await this.git!.branchLocal();
      const branchNames = branches.all;
      
      // Common main branch names
      const mainBranches = ['main', 'master', 'production', 'prod'];
      const mainBranch = mainBranches.find(b => branchNames.includes(b)) || branches.current;
      
      // Check for develop branch
      const developBranch = branchNames.includes('develop') ? 'develop' : undefined;
      
      // Check for git flow branches
      const hasGitFlow = branchNames.some(b => 
        b.startsWith('feature/') || 
        b.startsWith('release/') || 
        b.startsWith('hotfix/')
      );
      
      return {
        mainBranch,
        developBranch,
        hasGitFlow: hasGitFlow || !!developBranch
      };
    } catch {
      return {
        mainBranch: 'main',
        hasGitFlow: false
      };
    }
  }
  
  async getFileHistory(filePath: string, maxCount: number = 10): Promise<any[]> {
    if (!this.git) return [];
    
    try {
      const log = await this.git.log({
        file: filePath,
        maxCount
      });
      return [...log.all]; // Create a mutable copy
    } catch {
      return [];
    }
  }
}