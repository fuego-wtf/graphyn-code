import { ClaudeCodeAgent, AgentConfig } from '../base/ClaudeCodeAgent.js';
import type { Task } from '@graphyn/core';
import path from 'path';
import fs from 'fs/promises';
import { spawn } from 'child_process';
import yaml from 'yaml';

export interface DevOpsConfig extends AgentConfig {
  platform?: 'docker' | 'kubernetes' | 'aws' | 'vercel' | 'netlify';
  ciProvider?: 'github' | 'gitlab' | 'jenkins' | 'circleci';
  containerRegistry?: 'docker-hub' | 'ghcr' | 'ecr' | 'gcr';
  deploymentStrategy?: 'rolling' | 'blue-green' | 'canary';
  enableSecurityScanning?: boolean;
  enableMonitoring?: boolean;
  defaultRuntime?: 'node' | 'python' | 'java' | 'go' | 'dotnet';
}

export interface DockerConfig {
  baseImage: string;
  workdir: string;
  port?: number;
  volumes?: string[];
  environment?: Record<string, string>;
  buildArgs?: Record<string, string>;
  healthCheck?: {
    path: string;
    interval: string;
    timeout: string;
  };
}

export interface CIPipeline {
  name: string;
  provider: 'github-actions' | 'gitlab-ci' | 'azure-devops' | 'jenkins';
  triggers: string[];
  jobs: CIJob[];
  variables?: Record<string, string>;
  secrets?: string[];
}

export interface CIJob {
  name: string;
  runs_on?: string;
  steps: CIStep[];
  environment?: Record<string, string>;
}

export interface CIStep {
  name: string;
  uses?: string;
  run?: string;
  with?: Record<string, any>;
  env?: Record<string, string>;
}

export interface DeploymentConfig {
  platform: 'docker' | 'kubernetes' | 'heroku' | 'vercel' | 'aws';
  environment: 'development' | 'staging' | 'production';
  resources?: {
    cpu?: string;
    memory?: string;
    replicas?: number;
  };
  networking?: {
    port: number;
    domain?: string;
    ssl?: boolean;
  };
}

export class DevOpsAgent extends ClaudeCodeAgent {
  private readonly devopsConfig: DevOpsConfig;

  constructor(id: string, workspaceDir?: string, config?: Partial<DevOpsConfig>) {
    const devopsConfig: DevOpsConfig = {
      id,
      type: 'devops',
      specialization: 'DevOps & Deployment Automation',
      capabilities: [
        'Docker containerization',
        'CI/CD pipeline configuration', 
        'Infrastructure as Code',
        'Kubernetes manifests',
        'Cloud deployment',
        'Security configuration',
        'Monitoring setup',
        'Load balancer config'
      ],
      workspaceDir,
      tools: ['shell.exec', 'fs.read', 'fs.write', 'docker.build', 'kubectl.apply'],
      timeout: 600000, // 10 minutes for complex deployments
      maxRetries: 2,
      platform: 'docker',
      ciProvider: 'github',
      containerRegistry: 'ghcr',
      deploymentStrategy: 'rolling',
      enableSecurityScanning: true,
      enableMonitoring: true,
      defaultRuntime: 'node',
      ...config
    };
    
    super(devopsConfig);
    this.devopsConfig = devopsConfig;
  }

  protected buildTaskPrompt(task: Task): string {
    const basePrompt = super.buildTaskPrompt(task);
    const devopsContext = this.generateDevOpsContext();
    
    return `${basePrompt}

${devopsContext}

# DevOps Task Guidelines
- Create production-ready configurations with security best practices
- Include comprehensive monitoring, health checks, and observability
- Optimize for scalability, performance, and cost efficiency
- Implement proper secrets management and RBAC
- Generate complete documentation and deployment guides
- Follow infrastructure-as-code principles
- Ensure automated testing and validation

# Standard Deliverables
1. **Dockerfile** - Multi-stage build with security optimizations
2. **docker-compose.yml** - Local development and testing environment
3. **CI/CD Pipeline** - Automated build, test, and deployment workflow
4. **Kubernetes Manifests** - Production-ready k8s configurations with RBAC
5. **Infrastructure Code** - Terraform/CloudFormation for cloud resources
6. **Monitoring Config** - Health checks, metrics, and alerting setup
7. **Deployment Scripts** - Automated deployment with rollback capabilities
8. **Security Configuration** - Vulnerability scanning, secrets management
9. **Documentation** - Complete setup, operations, and troubleshooting guide

Analyze the codebase structure and create appropriate DevOps configurations for the detected technology stack.`;
  }

  private generateDevOpsContext(): string {
    return `# DevOps Agent Context

## Platform Configuration
**Target Platform:** ${this.devopsConfig.platform || 'docker'}
**CI Provider:** ${this.devopsConfig.ciProvider || 'github'}
**Container Registry:** ${this.devopsConfig.containerRegistry || 'ghcr'}
**Deployment Strategy:** ${this.devopsConfig.deploymentStrategy || 'rolling'}

## DevOps Capabilities
- **Containerization:** Docker, Podman, multi-stage builds
- **Orchestration:** Kubernetes, Docker Compose, Docker Swarm
- **CI/CD:** GitHub Actions, GitLab CI, Jenkins, CircleCI
- **Infrastructure:** Terraform, CloudFormation, Pulumi, CDK
- **Monitoring:** Prometheus, Grafana, ELK Stack, DataDog
- **Security:** RBAC, secrets management, vulnerability scanning
- **Cloud Platforms:** AWS, GCP, Azure, DigitalOcean

## Security Requirements
- Non-root containers with minimal base images
- Proper secrets management (never hardcode credentials)
- Network security policies and service mesh
- Resource limits and quotas
- Automated vulnerability scanning
- HTTPS/TLS configuration with cert-manager
- Container image signing and verification

## Performance & Scalability
- Multi-stage Docker builds with layer optimization
- Horizontal Pod Autoscaling (HPA)
- Load balancing and traffic distribution
- CDN integration for static assets
- Database connection pooling
- Resource optimization and cost monitoring`;
  }

  /**
   * Detect project technology stack from package.json
   */
  async analyzeProject(projectPath: string): Promise<{
    type: string;
    framework: string;
    database: string[];
    hasTests: boolean;
    buildScript: string;
  }> {
    try {
      const packagePath = path.join(projectPath, 'package.json');
      const content = await fs.readFile(packagePath, 'utf-8');
      const pkg = JSON.parse(content);
      
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      
      return {
        type: this.detectProjectType(deps),
        framework: this.detectFramework(deps),
        database: this.detectDatabases(deps),
        hasTests: !!pkg.scripts?.test,
        buildScript: pkg.scripts?.build || 'npm run build'
      };
    } catch {
      return {
        type: 'node',
        framework: 'unknown',
        database: [],
        hasTests: false,
        buildScript: 'npm run build'
      };
    }
  }

  private detectProjectType(deps: Record<string, string>): string {
    if (deps.react || deps['@types/react']) return 'react';
    if (deps.vue || deps['vue-cli-service']) return 'vue'; 
    if (deps.angular || deps['@angular/core']) return 'angular';
    if (deps.express || deps.koa || deps.fastify) return 'node-api';
    if (deps.next || deps['next.js']) return 'nextjs';
    if (deps.nuxt || deps['@nuxt/core']) return 'nuxtjs';
    return 'node';
  }

  private detectFramework(deps: Record<string, string>): string {
    if (deps.express) return 'express';
    if (deps.fastify) return 'fastify';
    if (deps.koa) return 'koa';
    if (deps.nest || deps['@nestjs/core']) return 'nestjs';
    return 'unknown';
  }

  private detectDatabases(deps: Record<string, string>): string[] {
    const databases: string[] = [];
    if (deps.pg || deps.postgres) databases.push('postgresql');
    if (deps.mysql || deps.mysql2) databases.push('mysql');
    if (deps.mongodb || deps.mongoose) databases.push('mongodb');
    if (deps.redis) databases.push('redis');
    if (deps.sqlite3 || deps['better-sqlite3']) databases.push('sqlite');
    return databases;
  }

  /**
   * Generate optimized Dockerfile for the application
   */
  async generateDockerfile(config: Partial<DockerConfig> = {}): Promise<string> {
    const dockerConfig: DockerConfig = {
      baseImage: config.baseImage || this.getDefaultBaseImage(),
      workdir: config.workdir || '/app',
      port: config.port || 3000,
      volumes: config.volumes || [],
      environment: config.environment || {},
      buildArgs: config.buildArgs || {},
      healthCheck: config.healthCheck || {
        path: '/health',
        interval: '30s',
        timeout: '3s'
      }
    };

    this.emit('log', {
      level: 'info',
      message: `Generating Dockerfile with base image: ${dockerConfig.baseImage}`
    });

    const lines: string[] = [];

    // Multi-stage build for optimization
    lines.push(`# Build stage`);
    lines.push(`FROM ${dockerConfig.baseImage} AS builder`);
    lines.push('');

    // Build arguments
    if (dockerConfig.buildArgs && Object.keys(dockerConfig.buildArgs).length > 0) {
      for (const [key, value] of Object.entries(dockerConfig.buildArgs)) {
        lines.push(`ARG ${key}=${value}`);
      }
      lines.push('');
    }

    // Set working directory
    lines.push(`WORKDIR ${dockerConfig.workdir}`);
    lines.push('');

    // Runtime-specific build instructions
    lines.push(...this.getBuildInstructions());
    lines.push('');

    // Production stage
    lines.push(`# Production stage`);
    lines.push(`FROM ${this.getProductionBaseImage()} AS production`);
    lines.push('');

    // Security: Create non-root user
    lines.push('# Create non-root user for security');
    lines.push('RUN groupadd -r appuser && useradd -r -g appuser appuser');
    lines.push('');

    // Set working directory
    lines.push(`WORKDIR ${dockerConfig.workdir}`);
    lines.push('');

    // Copy built application from builder stage
    lines.push('# Copy built application');
    lines.push(`COPY --from=builder --chown=appuser:appuser ${dockerConfig.workdir} .`);
    lines.push('');

    // Environment variables
    if (dockerConfig.environment && Object.keys(dockerConfig.environment).length > 0) {
      lines.push('# Environment variables');
      for (const [key, value] of Object.entries(dockerConfig.environment)) {
        lines.push(`ENV ${key}="${value}"`);
      }
      lines.push('');
    }

    // Volumes
    if (dockerConfig.volumes && dockerConfig.volumes.length > 0) {
      lines.push('# Volumes');
      for (const volume of dockerConfig.volumes) {
        lines.push(`VOLUME ${volume}`);
      }
      lines.push('');
    }

    // Expose port
    if (dockerConfig.port) {
      lines.push(`EXPOSE ${dockerConfig.port}`);
      lines.push('');
    }

    // Health check
    if (dockerConfig.healthCheck) {
      lines.push('# Health check');
      lines.push(`HEALTHCHECK --interval=${dockerConfig.healthCheck.interval} --timeout=${dockerConfig.healthCheck.timeout} --start-period=5s --retries=3 \\`);
      lines.push(`  CMD curl -f http://localhost:${dockerConfig.port}${dockerConfig.healthCheck.path} || exit 1`);
      lines.push('');
    }

    // Switch to non-root user
    lines.push('# Switch to non-root user');
    lines.push('USER appuser');
    lines.push('');

    // Start command
    lines.push('CMD ["npm", "start"]');

    const dockerfile = lines.join('\n');
    
    // Save Dockerfile
    const dockerfilePath = path.join(this.config.workspaceDir || '.', 'Dockerfile');
    await fs.writeFile(dockerfilePath, dockerfile);
    
    this.emit('log', {
      level: 'info',
      message: `Dockerfile generated: ${dockerfilePath}`
    });

    return dockerfile;
  }

  /**
   * Generate CI/CD pipeline configuration
   */
  async generateCIPipeline(pipeline: Partial<CIPipeline>): Promise<string> {
    const config: CIPipeline = {
      name: pipeline.name || 'Build and Deploy',
      provider: pipeline.provider || 'github-actions',
      triggers: pipeline.triggers || ['push', 'pull_request'],
      jobs: pipeline.jobs || this.getDefaultJobs(),
      variables: pipeline.variables || {},
      secrets: pipeline.secrets || []
    };

    this.emit('log', {
      level: 'info',
      message: `Generating ${config.provider} pipeline: ${config.name}`
    });

    let pipelineContent = '';
    let filePath = '';

    switch (config.provider) {
      case 'github-actions':
        pipelineContent = this.generateGitHubActions(config);
        filePath = '.github/workflows/deploy.yml';
        break;
      case 'gitlab-ci':
        pipelineContent = this.generateGitLabCI(config);
        filePath = '.gitlab-ci.yml';
        break;
      default:
        throw new Error(`Unsupported CI/CD provider: ${config.provider}`);
    }

    // Save pipeline file
    const fullPath = path.join(this.config.workspaceDir || '.', filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, pipelineContent);
    
    this.emit('log', {
      level: 'info',
      message: `CI/CD pipeline generated: ${fullPath}`
    });

    return pipelineContent;
  }

  /**
   * Generate Kubernetes deployment manifests
   */
  async generateKubernetesManifests(config: DeploymentConfig): Promise<void> {
    this.emit('log', {
      level: 'info',
      message: `Generating Kubernetes manifests for ${config.environment}`
    });

    const k8sDir = path.join(this.config.workspaceDir || '.', 'k8s');
    await fs.mkdir(k8sDir, { recursive: true });

    // Generate Deployment
    const deployment = this.generateK8sDeployment(config);
    await fs.writeFile(path.join(k8sDir, 'deployment.yaml'), deployment);

    // Generate Service
    const service = this.generateK8sService(config);
    await fs.writeFile(path.join(k8sDir, 'service.yaml'), service);

    // Generate ConfigMap
    const configMap = this.generateK8sConfigMap(config);
    await fs.writeFile(path.join(k8sDir, 'configmap.yaml'), configMap);

    // Generate Ingress if domain is specified
    if (config.networking?.domain) {
      const ingress = this.generateK8sIngress(config);
      await fs.writeFile(path.join(k8sDir, 'ingress.yaml'), ingress);
    }

    this.emit('log', {
      level: 'info',
      message: `Kubernetes manifests generated in: ${k8sDir}`
    });
  }

  /**
   * Run security scan on container image
   */
  async runSecurityScan(imageName: string): Promise<void> {
    if (!this.devopsConfig.enableSecurityScanning) {
      this.emit('log', {
        level: 'info',
        message: 'Security scanning disabled'
      });
      return;
    }

    this.emit('log', {
      level: 'info',
      message: `Running security scan on image: ${imageName}`
    });

    try {
      // Use Trivy for security scanning (if available)
      const scanResult = await this.runCommand('trivy', ['image', '--format', 'json', imageName]);
      
      if (scanResult.success) {
        const results = JSON.parse(scanResult.output);
        const vulnCount = results.Results?.[0]?.Vulnerabilities?.length || 0;
        
        this.emit('log', {
          level: vulnCount > 0 ? 'warn' : 'info',
          message: `Security scan completed: ${vulnCount} vulnerabilities found`
        });
      }
    } catch (error) {
      this.emit('log', {
        level: 'warn',
        message: `Security scan failed: ${error}. Install Trivy for security scanning.`
      });
    }
  }

  // Helper methods
  private getDefaultBaseImage(): string {
    switch (this.devopsConfig.defaultRuntime) {
      case 'node': return 'node:18-alpine';
      case 'python': return 'python:3.11-alpine';
      case 'java': return 'openjdk:17-alpine';
      case 'go': return 'golang:1.19-alpine';
      case 'dotnet': return 'mcr.microsoft.com/dotnet/aspnet:7.0-alpine';
      default: return 'node:18-alpine';
    }
  }

  private getProductionBaseImage(): string {
    switch (this.devopsConfig.defaultRuntime) {
      case 'node': return 'node:18-alpine';
      case 'python': return 'python:3.11-alpine';
      case 'java': return 'openjdk:17-jre-alpine';
      case 'go': return 'alpine:latest';
      case 'dotnet': return 'mcr.microsoft.com/dotnet/aspnet:7.0-alpine';
      default: return 'node:18-alpine';
    }
  }

  private getBuildInstructions(): string[] {
    switch (this.devopsConfig.defaultRuntime) {
      case 'node':
        return [
          '# Install dependencies',
          'COPY package*.json ./',
          'RUN npm ci --only=production && npm cache clean --force',
          '# Copy source code',
          'COPY . .',
          '# Build application',
          'RUN npm run build'
        ];
      case 'python':
        return [
          '# Install dependencies',
          'COPY requirements.txt .',
          'RUN pip install --no-cache-dir -r requirements.txt',
          '# Copy source code',
          'COPY . .'
        ];
      default:
        return ['# Copy application code', 'COPY . .'];
    }
  }

  private getDefaultJobs(): CIJob[] {
    return [
      {
        name: 'build-and-test',
        runs_on: 'ubuntu-latest',
        steps: [
          { name: 'Checkout code', uses: 'actions/checkout@v3' },
          { name: 'Setup Node.js', uses: 'actions/setup-node@v3', with: { 'node-version': '18' } },
          { name: 'Install dependencies', run: 'npm ci' },
          { name: 'Run tests', run: 'npm test' },
          { name: 'Build application', run: 'npm run build' },
          { name: 'Build Docker image', run: 'docker build -t app:latest .' }
        ]
      }
    ];
  }

  private generateGitHubActions(config: CIPipeline): string {
    const workflow = {
      name: config.name,
      on: config.triggers.reduce((acc, trigger) => {
        acc[trigger] = trigger === 'push' ? { branches: ['main', 'develop'] } : {};
        return acc;
      }, {} as any),
      env: config.variables,
      jobs: config.jobs.reduce((acc, job) => {
        acc[job.name.replace(/[^a-zA-Z0-9-_]/g, '-')] = {
          'runs-on': job.runs_on || 'ubuntu-latest',
          steps: job.steps.map(step => ({
            name: step.name,
            uses: step.uses,
            run: step.run,
            with: step.with,
            env: step.env
          }))
        };
        return acc;
      }, {} as any)
    };

    return yaml.stringify(workflow, { lineWidth: -1 });
  }

  private generateGitLabCI(config: CIPipeline): string {
    const gitlabCI: any = {
      stages: config.jobs.map(job => job.name),
      variables: config.variables
    };

    for (const job of config.jobs) {
      gitlabCI[job.name] = {
        stage: job.name,
        script: job.steps.filter(step => step.run).map(step => step.run),
        only: config.triggers,
        variables: job.environment
      };
    }

    return yaml.stringify(gitlabCI, { lineWidth: -1 });
  }

  private generateK8sDeployment(config: DeploymentConfig): string {
    const deployment = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: 'app',
        labels: { app: 'app' }
      },
      spec: {
        replicas: config.resources?.replicas || 3,
        selector: { matchLabels: { app: 'app' } },
        template: {
          metadata: { labels: { app: 'app' } },
          spec: {
            containers: [{
              name: 'app',
              image: 'app:latest',
              ports: [{ containerPort: config.networking?.port || 3000 }],
              resources: {
                requests: {
                  cpu: config.resources?.cpu || '100m',
                  memory: config.resources?.memory || '128Mi'
                },
                limits: {
                  cpu: config.resources?.cpu || '500m',
                  memory: config.resources?.memory || '512Mi'
                }
              },
              livenessProbe: {
                httpGet: {
                  path: '/health',
                  port: config.networking?.port || 3000
                },
                initialDelaySeconds: 30,
                periodSeconds: 10
              },
              readinessProbe: {
                httpGet: {
                  path: '/health',
                  port: config.networking?.port || 3000
                },
                initialDelaySeconds: 5,
                periodSeconds: 5
              }
            }]
          }
        }
      }
    };

    return yaml.stringify(deployment, { lineWidth: -1 });
  }

  private generateK8sService(config: DeploymentConfig): string {
    const service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: 'app-service',
        labels: { app: 'app' }
      },
      spec: {
        selector: { app: 'app' },
        ports: [{
          port: 80,
          targetPort: config.networking?.port || 3000,
          protocol: 'TCP'
        }],
        type: 'ClusterIP'
      }
    };

    return yaml.stringify(service, { lineWidth: -1 });
  }

  private generateK8sConfigMap(config: DeploymentConfig): string {
    const configMap = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: 'app-config'
      },
      data: {
        'NODE_ENV': config.environment,
        'PORT': String(config.networking?.port || 3000)
      }
    };

    return yaml.stringify(configMap, { lineWidth: -1 });
  }

  private generateK8sIngress(config: DeploymentConfig): string {
    const ingress = {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: {
        name: 'app-ingress',
        annotations: {
          'kubernetes.io/ingress.class': 'nginx',
          ...(config.networking?.ssl && {
            'cert-manager.io/cluster-issuer': 'letsencrypt-prod'
          })
        }
      },
      spec: {
        ...(config.networking?.ssl && {
          tls: [{
            hosts: [config.networking.domain],
            secretName: 'app-tls'
          }]
        }),
        rules: [{
          host: config.networking?.domain,
          http: {
            paths: [{
              path: '/',
              pathType: 'Prefix',
              backend: {
                service: {
                  name: 'app-service',
                  port: { number: 80 }
                }
              }
            }]
          }
        }]
      }
    };

    return yaml.stringify(ingress, { lineWidth: -1 });
  }

  private async runCommand(command: string, args: string[]): Promise<{
    success: boolean;
    output: string;
    error?: string;
  }> {
    return new Promise((resolve) => {
      const child = spawn(command, args, { stdio: 'pipe' });
      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          output: stdout,
          error: stderr || undefined
        });
      });

      child.on('error', (error) => {
        resolve({
          success: false,
          output: '',
          error: error.message
        });
      });
    });
  }
}
