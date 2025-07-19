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
 * Initialize .graphyn folder structure in the current project
 */
export async function initGraphynFolder(projectPath: string = process.cwd()): Promise<void> {
  const graphynPath = path.join(projectPath, '.graphyn');
  const docsPath = path.join(graphynPath, 'docs');
  const tempPath = path.join(docsPath, 'temp');
  
  // Create directories
  fs.mkdirSync(graphynPath, { recursive: true });
  fs.mkdirSync(docsPath, { recursive: true });
  fs.mkdirSync(tempPath, { recursive: true });
  
  // Initialize init.md if it doesn't exist
  const initMdPath = path.join(graphynPath, 'init.md');
  if (!fs.existsSync(initMdPath)) {
    const repoInfo = await getRepoInfo(projectPath);
    const initContent = generateInitMd(repoInfo);
    fs.writeFileSync(initMdPath, initContent);
  }
  
  // Create sitemap.md
  const sitemapPath = path.join(docsPath, 'sitemap.md');
  if (!fs.existsSync(sitemapPath)) {
    const sitemapContent = await generateSitemap(projectPath);
    fs.writeFileSync(sitemapPath, sitemapContent);
  }
  
  // Create servicemap.md
  const servicemapPath = path.join(docsPath, 'servicemap.md');
  if (!fs.existsSync(servicemapPath)) {
    const servicemapContent = await generateServicemap(projectPath);
    fs.writeFileSync(servicemapPath, servicemapContent);
  }
  
  // Create .gitignore for temp files
  const gitignorePath = path.join(graphynPath, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, 'docs/temp/\n');
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
 * Generate sitemap.md by analyzing project structure
 */
async function generateSitemap(projectPath: string): Promise<string> {
  const sitemap: string[] = ['# Project Sitemap\n'];
  
  function scanDirectory(dir: string, prefix: string = '', ignorePatterns: string[] = [
    'node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.graphyn'
  ]): void {
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      
      items.forEach(item => {
        // Skip ignored patterns
        if (ignorePatterns.some(pattern => item.name.includes(pattern))) {
          return;
        }
        
        const fullPath = path.join(dir, item.name);
        const relativePath = path.relative(projectPath, fullPath);
        
        if (item.isDirectory()) {
          sitemap.push(`${prefix}- **${item.name}/**`);
          scanDirectory(fullPath, prefix + '  ');
        } else if (item.isFile()) {
          const ext = path.extname(item.name);
          if (['.ts', '.tsx', '.js', '.jsx', '.md', '.json'].includes(ext)) {
            sitemap.push(`${prefix}- ${item.name}`);
          }
        }
      });
    } catch (error) {
      // Skip directories we can't read
    }
  }
  
  scanDirectory(projectPath);
  
  sitemap.push('\n## Key Files\n');
  
  // Check for common important files
  const keyFiles = [
    'package.json',
    'tsconfig.json',
    'README.md',
    'GRAPHYN.md',
    '.env.example',
    'docker-compose.yml'
  ];
  
  keyFiles.forEach(file => {
    if (fs.existsSync(path.join(projectPath, file))) {
      sitemap.push(`- ${file}`);
    }
  });
  
  return sitemap.join('\n');
}

/**
 * Generate servicemap.md by analyzing code structure
 */
async function generateServicemap(projectPath: string): Promise<string> {
  const servicemap: string[] = ['# Service Map\n'];
  
  // Check package.json for dependencies and scripts
  const packageJsonPath = path.join(projectPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      
      servicemap.push('## Project Info');
      servicemap.push(`- **Name**: ${packageJson.name || 'Unknown'}`);
      servicemap.push(`- **Version**: ${packageJson.version || 'Unknown'}`);
      servicemap.push(`- **Type**: ${packageJson.type || 'commonjs'}\n`);
      
      if (packageJson.scripts) {
        servicemap.push('## Available Scripts');
        Object.entries(packageJson.scripts).forEach(([name, script]) => {
          servicemap.push(`- \`npm run ${name}\`: ${script}`);
        });
        servicemap.push('');
      }
      
      // Detect frameworks
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      servicemap.push('## Detected Technologies');
      
      if (deps['next']) servicemap.push('- **Framework**: Next.js');
      else if (deps['react']) servicemap.push('- **Framework**: React');
      else if (deps['vue']) servicemap.push('- **Framework**: Vue');
      else if (deps['express']) servicemap.push('- **Framework**: Express');
      else if (deps['fastify']) servicemap.push('- **Framework**: Fastify');
      
      if (deps['typescript']) servicemap.push('- **Language**: TypeScript');
      if (deps['@clerk/nextjs']) servicemap.push('- **Auth**: Clerk');
      if (deps['prisma']) servicemap.push('- **ORM**: Prisma');
      if (deps['drizzle-orm']) servicemap.push('- **ORM**: Drizzle');
      
      servicemap.push('');
    } catch {
      // Failed to parse package.json
    }
  }
  
  // Analyze source structure
  servicemap.push('## Source Structure');
  
  const srcPath = path.join(projectPath, 'src');
  if (fs.existsSync(srcPath)) {
    const srcDirs = fs.readdirSync(srcPath, { withFileTypes: true })
      .filter(item => item.isDirectory())
      .map(item => item.name);
    
    srcDirs.forEach(dir => {
      servicemap.push(`- **src/${dir}/** - ${getDirectoryPurpose(dir)}`);
    });
  }
  
  // Check for API routes
  const apiPaths = [
    'pages/api',
    'app/api',
    'src/pages/api',
    'src/app/api'
  ];
  
  for (const apiPath of apiPaths) {
    const fullPath = path.join(projectPath, apiPath);
    if (fs.existsSync(fullPath)) {
      servicemap.push('\n## API Routes');
      scanApiRoutes(fullPath, projectPath, servicemap);
      break;
    }
  }
  
  return servicemap.join('\n');
}

/**
 * Get directory purpose based on common naming conventions
 */
function getDirectoryPurpose(dirName: string): string {
  const purposes: Record<string, string> = {
    'components': 'React/UI components',
    'pages': 'Page components/routes',
    'api': 'API endpoints',
    'utils': 'Utility functions',
    'lib': 'Library code',
    'hooks': 'React hooks',
    'services': 'Service layer',
    'models': 'Data models',
    'types': 'TypeScript types',
    'styles': 'CSS/styling',
    'public': 'Static assets',
    'tests': 'Test files',
    'config': 'Configuration files',
    'middleware': 'Middleware functions',
    'contexts': 'React contexts',
    'store': 'State management',
    'ink': 'Ink CLI components'
  };
  
  return purposes[dirName] || 'Project files';
}

/**
 * Scan API routes
 */
function scanApiRoutes(apiPath: string, projectPath: string, servicemap: string[]): void {
  function scan(dir: string, prefix: string = ''): void {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    
    items.forEach(item => {
      const fullPath = path.join(dir, item.name);
      const route = path.relative(apiPath, fullPath).replace(/\\/g, '/');
      
      if (item.isDirectory()) {
        scan(fullPath, prefix);
      } else if (item.isFile() && ['.ts', '.js'].includes(path.extname(item.name))) {
        const routePath = '/' + route.replace(/\.(ts|js)$/, '').replace(/\/index$/, '');
        servicemap.push(`- \`${routePath}\``);
      }
    });
  }
  
  scan(apiPath);
}

/**
 * Update servicemap with detected patterns
 */
export async function updateServicemap(patterns: string[], projectPath: string = process.cwd()): Promise<void> {
  const servicemapPath = path.join(projectPath, '.graphyn', 'docs', 'servicemap.md');
  
  if (fs.existsSync(servicemapPath)) {
    let content = fs.readFileSync(servicemapPath, 'utf-8');
    
    // Add detected patterns section if not exists
    if (!content.includes('## Detected Patterns')) {
      content += '\n## Detected Patterns\n';
    }
    
    patterns.forEach(pattern => {
      if (!content.includes(pattern)) {
        content += `- ${pattern}\n`;
      }
    });
    
    fs.writeFileSync(servicemapPath, content);
  }
}