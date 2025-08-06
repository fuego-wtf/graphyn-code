import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { RepositoryContext } from '../api-client.js';

export interface ProjectInfo {
  type: 'monorepo' | 'single' | 'unknown';
  root: string;
  projects?: {
    name: string;
    path: string;
    framework?: string;
    language?: string;
  }[];
  gitUrl?: string;
}

export class RepositoryDetector {
  /**
   * Detect repository type and structure
   */
  static async detectRepository(startPath: string = process.cwd()): Promise<ProjectInfo> {
    const root = this.findGitRoot(startPath) || startPath;
    const type = await this.detectRepoType(root);
    const gitUrl = this.getGitUrl(root);
    
    const info: ProjectInfo = {
      type,
      root,
      gitUrl,
    };

    if (type === 'monorepo') {
      info.projects = await this.detectMonorepoProjects(root);
    } else if (type === 'single') {
      const framework = await this.detectFramework(root);
      const language = await this.detectLanguage(root);
      info.projects = [{
        name: path.basename(root),
        path: '/',
        framework,
        language,
      }];
    }

    return info;
  }

  /**
   * Find git repository root
   */
  private static findGitRoot(startPath: string): string | null {
    let currentPath = path.resolve(startPath);
    
    while (currentPath !== '/') {
      if (fs.existsSync(path.join(currentPath, '.git'))) {
        return currentPath;
      }
      currentPath = path.dirname(currentPath);
    }
    
    return null;
  }

  /**
   * Get git remote URL
   */
  private static getGitUrl(repoPath: string): string | undefined {
    try {
      const remoteUrl = execSync('git remote get-url origin', {
        cwd: repoPath,
        encoding: 'utf-8',
      }).trim();
      
      // Convert SSH URLs to HTTPS format
      if (remoteUrl.startsWith('git@')) {
        return remoteUrl
          .replace('git@', 'https://')
          .replace('.com:', '.com/')
          .replace('.git', '');
      }
      
      return remoteUrl.replace('.git', '');
    } catch {
      return undefined;
    }
  }

  /**
   * Detect if repository is monorepo or single project
   */
  private static async detectRepoType(root: string): Promise<'monorepo' | 'single' | 'unknown'> {
    // Check for common monorepo indicators
    const monorepoIndicators = [
      'lerna.json',
      'rush.json',
      'pnpm-workspace.yaml',
      'nx.json',
    ];

    for (const indicator of monorepoIndicators) {
      if (fs.existsSync(path.join(root, indicator))) {
        return 'monorepo';
      }
    }

    // Check for packages directory
    const packagesPath = path.join(root, 'packages');
    if (fs.existsSync(packagesPath) && fs.statSync(packagesPath).isDirectory()) {
      const entries = fs.readdirSync(packagesPath);
      const hasPackageJsons = entries.some(entry => {
        const entryPath = path.join(packagesPath, entry);
        return fs.statSync(entryPath).isDirectory() && 
               fs.existsSync(path.join(entryPath, 'package.json'));
      });
      if (hasPackageJsons) return 'monorepo';
    }

    // Check for multiple project directories with package.json
    const projectDirs = ['frontend', 'backend', 'mobile', 'api', 'web', 'server', 'client'];
    let projectCount = 0;
    for (const dir of projectDirs) {
      const dirPath = path.join(root, dir);
      if (fs.existsSync(dirPath) && 
          fs.statSync(dirPath).isDirectory() &&
          fs.existsSync(path.join(dirPath, 'package.json'))) {
        projectCount++;
      }
    }
    if (projectCount >= 2) return 'monorepo';

    // Check if root has package.json
    if (fs.existsSync(path.join(root, 'package.json'))) {
      return 'single';
    }

    return 'unknown';
  }

  /**
   * Detect projects in a monorepo
   */
  private static async detectMonorepoProjects(root: string): Promise<ProjectInfo['projects']> {
    const projects: ProjectInfo['projects'] = [];
    const projectPaths: string[] = [];

    // Check packages directory
    const packagesPath = path.join(root, 'packages');
    if (fs.existsSync(packagesPath)) {
      const entries = fs.readdirSync(packagesPath);
      for (const entry of entries) {
        const entryPath = path.join(packagesPath, entry);
        if (fs.statSync(entryPath).isDirectory() && 
            fs.existsSync(path.join(entryPath, 'package.json'))) {
          projectPaths.push(path.join('packages', entry));
        }
      }
    }

    // Check common project directories
    const commonDirs = ['frontend', 'backend', 'mobile', 'api', 'web', 'server', 'client', 'docs'];
    for (const dir of commonDirs) {
      const dirPath = path.join(root, dir);
      if (fs.existsSync(dirPath) && 
          fs.statSync(dirPath).isDirectory() &&
          fs.existsSync(path.join(dirPath, 'package.json'))) {
        projectPaths.push(dir);
      }
    }

    // Analyze each project
    for (const projectPath of projectPaths) {
      const fullPath = path.join(root, projectPath);
      const framework = await this.detectFramework(fullPath);
      const language = await this.detectLanguage(fullPath);
      
      projects.push({
        name: path.basename(projectPath),
        path: `/${projectPath}`,
        framework,
        language,
      });
    }

    return projects;
  }

  /**
   * Detect framework used in a project
   */
  private static async detectFramework(projectPath: string): Promise<string | undefined> {
    const packageJsonPath = path.join(projectPath, 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      return undefined;
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      // Framework detection rules
      if (deps['next']) return 'nextjs';
      if (deps['react-native']) return 'react-native';
      if (deps['react'] && !deps['react-native']) return 'react';
      if (deps['vue']) return 'vue';
      if (deps['@angular/core']) return 'angular';
      if (deps['svelte']) return 'svelte';
      if (deps['express']) return 'express';
      if (deps['fastify']) return 'fastify';
      if (deps['@nestjs/core']) return 'nestjs';
      if (deps['koa']) return 'koa';
      if (deps['hapi']) return 'hapi';
      if (deps['django']) return 'django';
      if (deps['flask']) return 'flask';
      if (deps['fastapi']) return 'fastapi';

      // Check for docs frameworks
      if (deps['nextra']) return 'nextra';
      if (deps['docusaurus']) return 'docusaurus';
      if (deps['vitepress']) return 'vitepress';

      return undefined;
    } catch {
      return undefined;
    }

    // Additional framework detection for non-JS languages
    // Ruby frameworks
    if (fs.existsSync(path.join(projectPath, 'Gemfile'))) {
      try {
        const gemfile = fs.readFileSync(path.join(projectPath, 'Gemfile'), 'utf-8');
        if (gemfile.includes('rails')) return 'rails';
        if (gemfile.includes('sinatra')) return 'sinatra';
        if (gemfile.includes('hanami')) return 'hanami';
      } catch {}
    }

    // PHP frameworks
    if (fs.existsSync(path.join(projectPath, 'artisan'))) return 'laravel';
    if (fs.existsSync(path.join(projectPath, 'composer.json'))) {
      try {
        const composer = JSON.parse(fs.readFileSync(path.join(projectPath, 'composer.json'), 'utf-8'));
        const deps = { ...composer.require, ...composer['require-dev'] };
        if (deps['laravel/framework']) return 'laravel';
        if (deps['symfony/framework-bundle']) return 'symfony';
        if (deps['wordpress/wordpress']) return 'wordpress';
        if (deps['drupal/core']) return 'drupal';
      } catch {}
    }

    // Python frameworks
    if (fs.existsSync(path.join(projectPath, 'manage.py'))) return 'django';
    if (fs.existsSync(path.join(projectPath, 'requirements.txt'))) {
      try {
        const requirements = fs.readFileSync(path.join(projectPath, 'requirements.txt'), 'utf-8');
        if (requirements.includes('django')) return 'django';
        if (requirements.includes('flask')) return 'flask';
        if (requirements.includes('fastapi')) return 'fastapi';
      } catch {}
    }

    // C# frameworks
    if (fs.readdirSync(projectPath).some(file => file.endsWith('.csproj'))) {
      try {
        const csprojFiles = fs.readdirSync(projectPath).filter(file => file.endsWith('.csproj'));
        for (const file of csprojFiles) {
          const content = fs.readFileSync(path.join(projectPath, file), 'utf-8');
          if (content.includes('Microsoft.AspNetCore')) return 'aspnetcore';
          if (content.includes('Microsoft.NET.Sdk.BlazorWebAssembly')) return 'blazor';
        }
      } catch {}
    }

    // Elixir frameworks
    if (fs.existsSync(path.join(projectPath, 'mix.exs'))) {
      try {
        const mixFile = fs.readFileSync(path.join(projectPath, 'mix.exs'), 'utf-8');
        if (mixFile.includes('phoenix')) return 'phoenix';
      } catch {}
    }

    // Mobile frameworks
    if (fs.existsSync(path.join(projectPath, 'pubspec.yaml'))) {
      try {
        const pubspec = fs.readFileSync(path.join(projectPath, 'pubspec.yaml'), 'utf-8');
        if (pubspec.includes('flutter:')) return 'flutter';
      } catch {}
    }

    // Java frameworks
    if (fs.existsSync(path.join(projectPath, 'pom.xml'))) {
      try {
        const pom = fs.readFileSync(path.join(projectPath, 'pom.xml'), 'utf-8');
        if (pom.includes('spring-boot')) return 'springboot';
      } catch {}
    }
    if (fs.existsSync(path.join(projectPath, 'build.gradle')) || fs.existsSync(path.join(projectPath, 'build.gradle.kts'))) {
      try {
        const buildFile = fs.existsSync(path.join(projectPath, 'build.gradle')) 
          ? fs.readFileSync(path.join(projectPath, 'build.gradle'), 'utf-8')
          : fs.readFileSync(path.join(projectPath, 'build.gradle.kts'), 'utf-8');
        if (buildFile.includes('spring-boot')) return 'springboot';
      } catch {}
    }

    return undefined;
  }

  /**
   * Detect primary language of a project
   */
  private static async detectLanguage(projectPath: string): Promise<string | undefined> {
    // Check for TypeScript
    if (fs.existsSync(path.join(projectPath, 'tsconfig.json'))) {
      return 'typescript';
    }

    // Check for package.json (JavaScript/TypeScript)
    if (fs.existsSync(path.join(projectPath, 'package.json'))) {
      return 'javascript';
    }

    // Check for Python
    if (fs.existsSync(path.join(projectPath, 'requirements.txt')) ||
        fs.existsSync(path.join(projectPath, 'setup.py')) ||
        fs.existsSync(path.join(projectPath, 'pyproject.toml')) ||
        fs.existsSync(path.join(projectPath, 'Pipfile'))) {
      return 'python';
    }

    // Check for Go
    if (fs.existsSync(path.join(projectPath, 'go.mod'))) {
      return 'go';
    }

    // Check for Rust
    if (fs.existsSync(path.join(projectPath, 'Cargo.toml'))) {
      return 'rust';
    }

    // Check for Java
    if (fs.existsSync(path.join(projectPath, 'pom.xml')) ||
        fs.existsSync(path.join(projectPath, 'build.gradle')) ||
        fs.existsSync(path.join(projectPath, 'build.gradle.kts'))) {
      return 'java';
    }

    // Check for Ruby
    if (fs.existsSync(path.join(projectPath, 'Gemfile')) ||
        fs.existsSync(path.join(projectPath, '.ruby-version')) ||
        fs.existsSync(path.join(projectPath, 'Rakefile'))) {
      return 'ruby';
    }

    // Check for PHP
    if (fs.existsSync(path.join(projectPath, 'composer.json')) ||
        fs.existsSync(path.join(projectPath, 'index.php')) ||
        fs.existsSync(path.join(projectPath, 'artisan'))) {
      return 'php';
    }

    // Check for C/C++
    if (fs.existsSync(path.join(projectPath, 'CMakeLists.txt')) ||
        fs.existsSync(path.join(projectPath, 'Makefile')) ||
        fs.existsSync(path.join(projectPath, 'configure')) ||
        fs.existsSync(path.join(projectPath, 'main.cpp')) ||
        fs.existsSync(path.join(projectPath, 'main.c'))) {
      return 'cpp';
    }

    // Check for C#/.NET
    if (fs.existsSync(path.join(projectPath, 'Program.cs')) ||
        fs.existsSync(path.join(projectPath, 'project.json')) ||
        fs.readdirSync(projectPath).some(file => file.endsWith('.csproj')) ||
        fs.readdirSync(projectPath).some(file => file.endsWith('.sln'))) {
      return 'csharp';
    }

    // Check for Swift
    if (fs.existsSync(path.join(projectPath, 'Package.swift')) ||
        fs.existsSync(path.join(projectPath, 'Podfile')) ||
        fs.readdirSync(projectPath).some(file => file.endsWith('.xcodeproj'))) {
      return 'swift';
    }

    // Check for Kotlin
    if (fs.existsSync(path.join(projectPath, 'build.gradle.kts')) ||
        fs.existsSync(path.join(projectPath, 'settings.gradle.kts')) ||
        fs.readdirSync(projectPath).some(file => file.endsWith('.kt'))) {
      return 'kotlin';
    }

    // Check for Elixir
    if (fs.existsSync(path.join(projectPath, 'mix.exs')) ||
        fs.existsSync(path.join(projectPath, '.formatter.exs'))) {
      return 'elixir';
    }

    // Check for Dart/Flutter
    if (fs.existsSync(path.join(projectPath, 'pubspec.yaml')) ||
        fs.existsSync(path.join(projectPath, 'pubspec.lock'))) {
      return 'dart';
    }

    // Check for Scala
    if (fs.existsSync(path.join(projectPath, 'build.sbt')) ||
        fs.existsSync(path.join(projectPath, 'project/build.properties'))) {
      return 'scala';
    }

    // Check for Haskell
    if (fs.existsSync(path.join(projectPath, 'stack.yaml')) ||
        fs.existsSync(path.join(projectPath, 'cabal.project')) ||
        fs.readdirSync(projectPath).some(file => file.endsWith('.cabal'))) {
      return 'haskell';
    }

    return undefined;
  }

  /**
   * Get current context based on working directory
   */
  static async getCurrentContext(): Promise<RepositoryContext> {
    const cwd = process.cwd();
    const projectInfo = await this.detectRepository(cwd);
    
    // Find which project we're currently in
    let currentProject;
    if (projectInfo.type === 'monorepo' && projectInfo.projects) {
      const relativePath = path.relative(projectInfo.root, cwd);
      currentProject = projectInfo.projects.find(p => 
        relativePath.startsWith(p.path.slice(1))
      );
    }

    return {
      url: projectInfo.gitUrl,
      path: path.relative(projectInfo.root, cwd) || '/',
      type: projectInfo.type,
      framework: currentProject?.framework,
      language: currentProject?.language,
    };
  }
}