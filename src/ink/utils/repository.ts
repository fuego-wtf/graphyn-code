import { simpleGit } from 'simple-git';
import fs from 'fs/promises';
import path from 'path';

export interface RepositoryInfo {
  name: string;
  url?: string;
  branch?: string;
  isGitRepo: boolean;
}

export interface FrameworkInfo {
  name: string;
  version?: string;
  language: string;
}

export const detectRepository = async (): Promise<RepositoryInfo> => {
  const git = simpleGit();
  
  try {
    const isRepo = await git.checkIsRepo();
    
    if (isRepo) {
      const remotes = await git.getRemotes(true);
      const origin = remotes.find(r => r.name === 'origin');
      const url = origin?.refs?.fetch || '';
      
      const branch = await git.branchLocal();
      const currentBranch = branch.current;
      
      // Extract project name from URL
      let name = 'my-project';
      if (url) {
        const match = url.match(/\/([^\/]+?)(\.git)?$/);
        if (match) {
          name = match[1];
        }
      }
      
      return {
        name,
        url,
        branch: currentBranch,
        isGitRepo: true
      };
    }
  } catch (error) {
    // Not a git repo or git not available
  }
  
  // Fallback to directory name
  return {
    name: path.basename(process.cwd()),
    isGitRepo: false
  };
};

export const detectFramework = async (): Promise<FrameworkInfo> => {
  // Check package.json
  try {
    const packageJson = await fs.readFile('package.json', 'utf-8');
    const pkg = JSON.parse(packageJson);
    
    // React ecosystem
    if (pkg.dependencies?.react || pkg.devDependencies?.react) {
      if (pkg.dependencies?.next) {
        return { name: 'nextjs', version: pkg.dependencies.next, language: 'javascript' };
      }
      if (pkg.dependencies?.['react-native']) {
        return { name: 'react-native', version: pkg.dependencies['react-native'], language: 'javascript' };
      }
      return { name: 'react', version: pkg.dependencies?.react || pkg.devDependencies?.react, language: 'javascript' };
    }
    
    // Vue ecosystem
    if (pkg.dependencies?.vue || pkg.devDependencies?.vue) {
      if (pkg.dependencies?.nuxt) {
        return { name: 'nuxt', version: pkg.dependencies.nuxt, language: 'javascript' };
      }
      return { name: 'vue', version: pkg.dependencies?.vue || pkg.devDependencies?.vue, language: 'javascript' };
    }
    
    // Other JS frameworks
    if (pkg.dependencies?.svelte || pkg.devDependencies?.svelte) {
      return { name: 'svelte', version: pkg.dependencies?.svelte || pkg.devDependencies?.svelte, language: 'javascript' };
    }
    
    if (pkg.dependencies?.angular || pkg.devDependencies?.['@angular/core']) {
      return { name: 'angular', language: 'javascript' };
    }
    
    // Backend frameworks
    if (pkg.dependencies?.express) {
      return { name: 'express', version: pkg.dependencies.express, language: 'javascript' };
    }
    
    if (pkg.dependencies?.fastify) {
      return { name: 'fastify', version: pkg.dependencies.fastify, language: 'javascript' };
    }
    
    if (pkg.dependencies?.nestjs || pkg.dependencies?.['@nestjs/core']) {
      return { name: 'nestjs', language: 'javascript' };
    }
    
    // Default to Node.js if package.json exists
    return { name: 'nodejs', language: 'javascript' };
  } catch {
    // No package.json, check other files
  }
  
  // Go
  try {
    await fs.access('go.mod');
    const goMod = await fs.readFile('go.mod', 'utf-8');
    const moduleMatch = goMod.match(/^module\s+(.+)$/m);
    return { name: 'go', language: 'go' };
  } catch {
    // Not Go
  }
  
  // Rust
  try {
    await fs.access('Cargo.toml');
    return { name: 'rust', language: 'rust' };
  } catch {
    // Not Rust
  }
  
  // Python
  try {
    await fs.access('requirements.txt');
    return { name: 'python', language: 'python' };
  } catch {
    try {
      await fs.access('pyproject.toml');
      return { name: 'python', language: 'python' };
    } catch {
      // Not Python
    }
  }
  
  // Ruby
  try {
    await fs.access('Gemfile');
    return { name: 'ruby', language: 'ruby' };
  } catch {
    // Not Ruby
  }
  
  return { name: 'unknown', language: 'unknown' };
};