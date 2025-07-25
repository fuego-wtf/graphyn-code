import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface RepoInfo {
  name: string;
  branch: string;
  remote?: string;
  lastCommit?: string;
}

/**
 * Check if docs folder exists in the project
 */
export async function checkDocsFolder(projectPath: string = process.cwd()): Promise<boolean> {
  const docsPath = path.join(projectPath, 'docs');
  return fs.existsSync(docsPath) && fs.statSync(docsPath).isDirectory();
}

/**
 * Initialize graphyn folder structure in the current project
 */
export async function initGraphynFolder(projectPath: string = process.cwd()): Promise<void> {
  const graphynPath = path.join(projectPath, '.graphyn');
  const docsPath = path.join(graphynPath, 'docs');
  const tempPath = path.join(docsPath, 'temp');
  
  // Create .graphyn directory (with dot prefix)
  fs.mkdirSync(graphynPath, { recursive: true });
  
  // Check if project has a /docs folder
  const projectDocsPath = path.join(projectPath, 'docs');
  if (fs.existsSync(projectDocsPath) && fs.statSync(projectDocsPath).isDirectory()) {
    // Move existing docs folder to .graphyn/docs
    if (!fs.existsSync(docsPath)) {
      fs.renameSync(projectDocsPath, docsPath);
      console.log('📁 Moved existing /docs folder to .graphyn/docs');
    }
  } else {
    // Create docs structure if no existing docs folder
    fs.mkdirSync(docsPath, { recursive: true });
  }
  
  // Ensure temp directory exists
  fs.mkdirSync(tempPath, { recursive: true });
  
  // Move GRAPHYN.md to .graphyn folder if it exists in root
  const rootGraphynMdPath = path.join(projectPath, 'GRAPHYN.md');
  const graphynMdPath = path.join(graphynPath, 'GRAPHYN.md');
  if (fs.existsSync(rootGraphynMdPath) && !fs.existsSync(graphynMdPath)) {
    fs.renameSync(rootGraphynMdPath, graphynMdPath);
    console.log('📄 Moved GRAPHYN.md to .graphyn folder');
  }
  
  // Initialize init.md if it doesn't exist
  const initMdPath = path.join(graphynPath, 'init.md');
  if (!fs.existsSync(initMdPath)) {
    const repoInfo = await getRepoInfo(projectPath);
    const initContent = generateInitMd(repoInfo);
    fs.writeFileSync(initMdPath, initContent);
  }
  
  // Create map.md with base outline
  const mapPath = path.join(graphynPath, 'map.md');
  if (!fs.existsSync(mapPath)) {
    const mapContent = generateBaseMapMd(projectPath);
    fs.writeFileSync(mapPath, mapContent);
  }
  
  // Create focus.md with base outline
  const focusPath = path.join(graphynPath, 'focus.md');
  if (!fs.existsSync(focusPath)) {
    const projectName = path.basename(projectPath);
    const focusContent = generateBaseFocusMd(projectName);
    fs.writeFileSync(focusPath, focusContent);
  }
  
  // Update root .gitignore to handle .graphyn folder
  const rootGitignorePath = path.join(projectPath, '.gitignore');
  if (fs.existsSync(rootGitignorePath)) {
    try {
      let gitignoreContent = fs.readFileSync(rootGitignorePath, 'utf-8');
      
      // Check if .graphyn is already handled
      if (!gitignoreContent.includes('.graphyn/')) {
        // Add .graphyn folder rules
        const graphynRules = `\n# Graphyn local workspace\n.graphyn/*\n!.graphyn/map.md\n!.graphyn/focus.md\n`;
        gitignoreContent += graphynRules;
        fs.writeFileSync(rootGitignorePath, gitignoreContent);
        console.log('✅ Updated .gitignore to track .graphyn/map.md and focus.md');
      }
    } catch (error) {
      // Ignore errors
    }
  }
}

/**
 * Append content to init.md with timestamp
 */
export function appendToInitMd(content: string, projectPath: string = process.cwd()): void {
  const initMdPath = path.join(projectPath, '.graphyn', 'init.md');
  const timestamp = new Date().toISOString();
  
  const entry = `\n## Session ${timestamp}\n\n${content}\n`;
  
  fs.appendFileSync(initMdPath, entry);
}

/**
 * Save temporary documentation
 */
export function saveTempDoc(filename: string, content: string, projectPath: string = process.cwd()): string {
  const tempPath = path.join(projectPath, '.graphyn', 'docs', 'temp');
  const filePath = path.join(tempPath, filename);
  
  fs.writeFileSync(filePath, content);
  
  // Append reference to init.md
  appendToInitMd(`- Temporary doc saved: [${filename}](docs/temp/${filename})`, projectPath);
  
  return filePath;
}

/**
 * Get repository information
 */
async function getRepoInfo(projectPath: string): Promise<RepoInfo> {
  try {
    process.chdir(projectPath);
    
    const name = path.basename(projectPath);
    const branch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
    
    let remote: string | undefined;
    let lastCommit: string | undefined;
    
    try {
      remote = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
      lastCommit = execSync('git log -1 --oneline', { encoding: 'utf-8' }).trim();
    } catch {
      // Repository might not have a remote or commits
    }
    
    return { name, branch, remote, lastCommit };
  } catch {
    // Not a git repository
    return { name: path.basename(projectPath), branch: 'main' };
  }
}

/**
 * Generate initial init.md content
 */
function generateInitMd(repoInfo: RepoInfo): string {
  return `# ${repoInfo.name} - Graphyn Notes

## Repository Information
- **Name**: ${repoInfo.name}
- **Branch**: ${repoInfo.branch}
${repoInfo.remote ? `- **Remote**: ${repoInfo.remote}` : ''}
${repoInfo.lastCommit ? `- **Last Commit**: ${repoInfo.lastCommit}` : ''}
- **Initialized**: ${new Date().toISOString()}

## Purpose
This file captures notes, decisions, and temporary documentation from Graphyn and Claude Code sessions.

## Sessions
<!-- Sessions will be appended below -->
`;
}

/**
 * Generate base map.md outline
 */
function generateBaseMapMd(projectPath: string): string {
  const projectName = path.basename(projectPath);
  const packageJsonPath = path.join(projectPath, 'package.json');
  let projectType = 'Unknown';
  let packageInfo = '';
  
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      packageInfo = `\n**Package**: ${pkg.name || 'unnamed'}\n**Version**: ${pkg.version || '0.0.0'}`;
      
      // Detect project type from dependencies
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps['next']) projectType = 'Next.js Application';
      else if (deps['react'] && !deps['react-native']) projectType = 'React Application';
      else if (deps['vue']) projectType = 'Vue Application';
      else if (deps['express'] || deps['fastify']) projectType = 'Node.js Backend';
      else if (deps['@angular/core']) projectType = 'Angular Application';
      else if (pkg.bin) projectType = 'CLI Tool';
      else if (deps['react-native']) projectType = 'React Native App';
    } catch (e) {
      // Ignore parse errors
    }
  }
  
  return `# ${projectName} - Repository Map

**Type**: ${projectType}${packageInfo}
**Last Updated**: ${new Date().toISOString().split('T')[0]}

## 📋 TODO: Claude Code, please help complete this map by:

1. **Analyzing the repository structure** to understand:
   - Directory organization and purpose
   - Key files and their relationships
   - Configuration and build setup

2. **Identifying the architecture patterns**:
   - Design patterns used
   - State management approach
   - API/service structure

3. **Documenting key workflows**:
   - Development setup and commands
   - Build and deployment process
   - Testing strategies

4. **Mapping integration points**:
   - External services and APIs
   - Authentication methods
   - Database connections

## Repository Structure

[Claude: Please analyze and document the directory structure]

## Key Components

[Claude: Please identify and describe the main components/services]

## Development Workflows

[Claude: Please document common development tasks and commands]

## Architecture Notes

[Claude: Please add any important architectural decisions or patterns]
`;
}

/**
 * Generate base focus.md outline
 */
function generateBaseFocusMd(projectName: string): string {
  return `# ${projectName} - Development Focus

**Created**: ${new Date().toISOString().split('T')[0]}

## 🎯 Current Focus

[Claude: Please help identify the current development priorities by analyzing recent commits, open issues, or asking the developer]

## 📝 Active Tasks

[Claude: What are the immediate tasks that need attention?]

## 🚧 Known Issues

[Claude: Please document any bugs, technical debt, or blockers]

## 💡 Ideas & Improvements

[Claude: Capture any enhancement ideas or architectural improvements]

## 📊 Progress Notes

[Claude: Track implementation progress and decisions made]
`;
}




/**
 * Update map.md with detected patterns
 */
export async function updateMapWithPatterns(patterns: string[], projectPath: string = process.cwd()): Promise<void> {
  const mapPath = path.join(projectPath, '.graphyn', 'map.md');
  
  if (fs.existsSync(mapPath)) {
    let content = fs.readFileSync(mapPath, 'utf-8');
    
    // Add detected patterns section if not exists
    if (!content.includes('## Detected Patterns')) {
      content += '\n## Detected Patterns\n';
    }
    
    patterns.forEach(pattern => {
      if (!content.includes(pattern)) {
        content += `- ${pattern}\n`;
      }
    });
    
    fs.writeFileSync(mapPath, content);
  }
}