import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

export interface TechStackContext {
  detected_stack: string[];
  patterns: string[];
  databases?: string[];
  authentication?: string[];
  frameworks?: {
    frontend?: string[];
    backend?: string[];
  };
  deployment?: string[];
}

export async function detectTechStack(rootPath: string): Promise<TechStackContext> {
  const context: TechStackContext = {
    detected_stack: [],
    patterns: [],
    databases: [],
    authentication: [],
    frameworks: {
      frontend: [],
      backend: []
    },
    deployment: []
  };

  try {
    // Check package.json
    const packageJsonPath = path.join(rootPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      await analyzePackageJson(packageJson, context);
    }

    // Check for various config files
    await checkConfigFiles(rootPath, context);

    // Check for framework-specific patterns
    await detectFrameworkPatterns(rootPath, context);

    // Check for database configurations
    await detectDatabases(rootPath, context);

    // Check for authentication patterns
    await detectAuthentication(rootPath, context);

    // Check for deployment configurations
    await detectDeployment(rootPath, context);

    // Deduplicate arrays
    context.detected_stack = [...new Set(context.detected_stack)];
    context.patterns = [...new Set(context.patterns)];
    context.databases = [...new Set(context.databases)];
    context.authentication = [...new Set(context.authentication)];
    if (context.frameworks) {
      context.frameworks.frontend = [...new Set(context.frameworks.frontend || [])];
      context.frameworks.backend = [...new Set(context.frameworks.backend || [])];
    }
    context.deployment = [...new Set(context.deployment)];

  } catch (error) {
    console.error('Error detecting tech stack:', error);
  }

  return context;
}

async function analyzePackageJson(packageJson: any, context: TechStackContext) {
  const deps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };

  // Frontend frameworks
  if (deps['next']) {
    context.detected_stack.push('nextjs');
    context.frameworks!.frontend!.push('Next.js');
    context.patterns.push('Server-Side Rendering');
  }
  if (deps['react']) {
    context.detected_stack.push('react');
    context.frameworks!.frontend!.push('React');
  }
  if (deps['vue']) {
    context.detected_stack.push('vue');
    context.frameworks!.frontend!.push('Vue.js');
  }
  if (deps['@angular/core']) {
    context.detected_stack.push('angular');
    context.frameworks!.frontend!.push('Angular');
  }
  if (deps['svelte']) {
    context.detected_stack.push('svelte');
    context.frameworks!.frontend!.push('Svelte');
  }

  // Backend frameworks
  if (deps['express']) {
    context.detected_stack.push('express');
    context.frameworks!.backend!.push('Express.js');
  }
  if (deps['fastify']) {
    context.detected_stack.push('fastify');
    context.frameworks!.backend!.push('Fastify');
  }
  if (deps['@nestjs/core']) {
    context.detected_stack.push('nestjs');
    context.frameworks!.backend!.push('NestJS');
  }
  if (deps['koa']) {
    context.detected_stack.push('koa');
    context.frameworks!.backend!.push('Koa');
  }

  // Languages
  if (deps['typescript']) {
    context.detected_stack.push('typescript');
    context.patterns.push('TypeScript');
  }

  // Testing
  if (deps['jest'] || deps['vitest']) {
    context.patterns.push('Testing Framework');
  }

  // Databases
  if (deps['mongoose']) {
    context.databases!.push('MongoDB');
  }
  if (deps['pg'] || deps['postgres']) {
    context.databases!.push('PostgreSQL');
  }
  if (deps['mysql'] || deps['mysql2']) {
    context.databases!.push('MySQL');
  }
  if (deps['redis']) {
    context.databases!.push('Redis');
  }
  if (deps['@prisma/client']) {
    context.databases!.push('Prisma ORM');
    context.patterns.push('ORM');
  }
  if (deps['typeorm']) {
    context.databases!.push('TypeORM');
    context.patterns.push('ORM');
  }

  // Authentication
  if (deps['passport']) {
    context.authentication!.push('Passport.js');
  }
  if (deps['jsonwebtoken']) {
    context.authentication!.push('JWT');
  }
  if (deps['@clerk/nextjs'] || deps['@clerk/clerk-sdk-node']) {
    context.authentication!.push('Clerk');
  }
  if (deps['@auth0/nextjs-auth0']) {
    context.authentication!.push('Auth0');
  }
  if (deps['better-auth']) {
    context.authentication!.push('Better Auth');
  }

  // CSS/Styling
  if (deps['tailwindcss']) {
    context.patterns.push('Tailwind CSS');
  }
  if (deps['styled-components']) {
    context.patterns.push('CSS-in-JS');
  }

  // Build tools
  if (deps['vite']) {
    context.patterns.push('Vite');
  }
  if (deps['webpack']) {
    context.patterns.push('Webpack');
  }

  // State management
  if (deps['redux'] || deps['@reduxjs/toolkit']) {
    context.patterns.push('Redux');
  }
  if (deps['zustand']) {
    context.patterns.push('Zustand');
  }
  if (deps['mobx']) {
    context.patterns.push('MobX');
  }
}

async function checkConfigFiles(rootPath: string, context: TechStackContext) {
  // Check for Next.js
  if (fs.existsSync(path.join(rootPath, 'next.config.js')) || 
      fs.existsSync(path.join(rootPath, 'next.config.mjs'))) {
    context.detected_stack.push('nextjs');
    context.frameworks!.frontend!.push('Next.js');
  }

  // Check for Encore
  if (fs.existsSync(path.join(rootPath, 'encore.app'))) {
    context.detected_stack.push('encore');
    context.frameworks!.backend!.push('Encore.dev');
    context.patterns.push('Cloud-Native Backend');
  }

  // Check for Docker
  if (fs.existsSync(path.join(rootPath, 'Dockerfile')) || 
      fs.existsSync(path.join(rootPath, 'docker-compose.yml'))) {
    context.deployment!.push('Docker');
  }

  // Check for Kubernetes
  const k8sFiles = await glob('**/*.{yaml,yml}', { 
    cwd: rootPath,
    ignore: ['node_modules/**']
  });
  
  for (const file of k8sFiles) {
    const content = fs.readFileSync(path.join(rootPath, file), 'utf8');
    if (content.includes('apiVersion:') && content.includes('kind:')) {
      context.deployment!.push('Kubernetes');
      break;
    }
  }

  // Check for Terraform
  if (await glob('**/*.tf', { cwd: rootPath }).then(files => files.length > 0)) {
    context.deployment!.push('Terraform');
  }

  // Check for GitHub Actions
  if (fs.existsSync(path.join(rootPath, '.github/workflows'))) {
    context.deployment!.push('GitHub Actions');
  }
}

async function detectFrameworkPatterns(rootPath: string, context: TechStackContext) {
  // Check for React patterns
  const jsxFiles = await glob('**/*.{jsx,tsx}', {
    cwd: rootPath,
    ignore: ['node_modules/**']
  });
  
  if (jsxFiles.length > 0) {
    context.patterns.push('JSX/TSX Components');
  }

  // Check for API routes
  if (fs.existsSync(path.join(rootPath, 'pages/api')) || 
      fs.existsSync(path.join(rootPath, 'app/api'))) {
    context.patterns.push('API Routes');
  }

  // Check for GraphQL
  const graphqlFiles = await glob('**/*.{graphql,gql}', {
    cwd: rootPath,
    ignore: ['node_modules/**']
  });
  
  if (graphqlFiles.length > 0) {
    context.patterns.push('GraphQL');
  }

  // Check for tRPC
  if (fs.existsSync(path.join(rootPath, 'server/trpc.ts')) ||
      fs.existsSync(path.join(rootPath, 'src/server/trpc.ts'))) {
    context.patterns.push('tRPC');
  }
}

async function detectDatabases(rootPath: string, context: TechStackContext) {
  // Check for Prisma
  if (fs.existsSync(path.join(rootPath, 'prisma/schema.prisma'))) {
    context.databases!.push('Prisma ORM');
    
    // Read schema to detect database
    const schema = fs.readFileSync(path.join(rootPath, 'prisma/schema.prisma'), 'utf8');
    if (schema.includes('provider = "postgresql"')) {
      context.databases!.push('PostgreSQL');
    } else if (schema.includes('provider = "mysql"')) {
      context.databases!.push('MySQL');
    } else if (schema.includes('provider = "mongodb"')) {
      context.databases!.push('MongoDB');
    }
  }

  // Check for database migrations
  if (fs.existsSync(path.join(rootPath, 'migrations')) ||
      fs.existsSync(path.join(rootPath, 'db/migrations'))) {
    context.patterns.push('Database Migrations');
  }
}

async function detectAuthentication(rootPath: string, context: TechStackContext) {
  // Search for auth-related files
  const authFiles = await glob('**/auth/**/*.{js,ts,jsx,tsx}', {
    cwd: rootPath,
    ignore: ['node_modules/**']
  });

  if (authFiles.length > 0) {
    context.patterns.push('Authentication System');
  }

  // Check for OAuth patterns
  const files = await glob('**/*.{js,ts,jsx,tsx}', {
    cwd: rootPath,
    ignore: ['node_modules/**'],
    // Limit search for performance
    follow: false,
    dot: false
  });

  // Sample a few files to check for OAuth patterns
  const samplesToCheck = files.slice(0, 20);
  for (const file of samplesToCheck) {
    try {
      const content = fs.readFileSync(path.join(rootPath, file), 'utf8');
      if (content.includes('OAuth') || content.includes('oauth')) {
        context.authentication!.push('OAuth');
        break;
      }
    } catch {
      // Ignore read errors
    }
  }
}

async function detectDeployment(rootPath: string, context: TechStackContext) {
  // Check for Vercel
  if (fs.existsSync(path.join(rootPath, 'vercel.json')) ||
      fs.existsSync(path.join(rootPath, '.vercel'))) {
    context.deployment!.push('Vercel');
  }

  // Check for Netlify
  if (fs.existsSync(path.join(rootPath, 'netlify.toml'))) {
    context.deployment!.push('Netlify');
  }

  // Check for AWS
  if (fs.existsSync(path.join(rootPath, 'serverless.yml')) ||
      fs.existsSync(path.join(rootPath, 'template.yaml'))) {
    context.deployment!.push('AWS');
  }

  // Check for Heroku
  if (fs.existsSync(path.join(rootPath, 'Procfile'))) {
    context.deployment!.push('Heroku');
  }
}