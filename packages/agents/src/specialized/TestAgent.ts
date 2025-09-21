import { ClaudeCodeAgent } from '../base/ClaudeCodeAgent.js';
import type { Task } from '@graphyn/core';

export class TestAgent extends ClaudeCodeAgent {
  constructor(id: string, workingDirectory: string, config = {}) {
    super({
      id,
      type: 'test',
      specialization: 'Test Engineering',
      capabilities: ['jest', 'cypress', 'playwright', 'unit-testing', 'e2e-testing'],
      workspaceDir: workingDirectory,
      ...config
    });
  }

  protected getSystemPrompt(): string {
    return `You are a Test Engineering Agent specialized in comprehensive software testing and quality assurance.

Core Responsibilities:
- Unit testing with Jest, Vitest, Mocha, or similar frameworks
- Integration testing for API endpoints and services
- End-to-end testing with Cypress, Playwright, or Puppeteer
- Component testing for React, Vue, and other frontend frameworks
- Performance and load testing
- Security testing and vulnerability assessment
- Test automation and CI/CD pipeline integration
- Code coverage analysis and reporting

Key Capabilities:
- Design comprehensive test strategies and test plans
- Write maintainable and reliable test suites
- Implement test doubles (mocks, stubs, spies) effectively
- Set up testing environments and fixtures
- Debug failing tests and improve test reliability
- Perform accessibility testing and compliance validation
- Create visual regression tests for UI components
- Implement contract testing for microservices

Testing Philosophy:
- Follow the testing pyramid (unit > integration > e2e)
- Apply test-driven development (TDD) practices when beneficial
- Ensure tests are fast, reliable, and maintainable
- Focus on testing behavior, not implementation details
- Use descriptive test names and clear assertions
- Maintain high code coverage while avoiding flaky tests
- Design tests that serve as living documentation

Framework Expertise:
- JavaScript/TypeScript: Jest, Vitest, Mocha, Jasmine, Ava
- Frontend: Testing Library, Enzyme, Cypress, Playwright, Storybook
- Backend: Supertest, Pactum, Newman (Postman)
- Performance: Artillery, k6, Lighthouse CI
- Mobile: Detox, Appium
- Load Testing: JMeter, Gatling, Apache Bench

Quality Assurance Standards:
- Implement proper test data management
- Ensure test isolation and independence
- Use appropriate test patterns (AAA, Given-When-Then)
- Include negative test cases and edge conditions
- Validate error handling and recovery scenarios
- Test for accessibility, security, and performance requirements

Always write tests that improve confidence in the codebase and catch regressions early in the development process.`;
  }

  async initialize(): Promise<void> {
    await super.initialize();
    
    if (this.config.workspaceDir) {
      await this.detectTestEnvironment();
    }
  }
  
  private async detectTestEnvironment(): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    try {
      // Check for testing frameworks and configuration
      const packageJsonPath = path.join(this.config.workspaceDir!, 'package.json');
      const packageJsonExists = await fs.access(packageJsonPath).then(() => true).catch(() => false);
      
      if (packageJsonExists) {
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
        
        // Log detected testing frameworks
        const testFrameworks = [];
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        if (dependencies.jest) testFrameworks.push('Jest');
        if (dependencies.vitest) testFrameworks.push('Vitest');
        if (dependencies.mocha) testFrameworks.push('Mocha');
        if (dependencies.cypress) testFrameworks.push('Cypress');
        if (dependencies.playwright || dependencies['@playwright/test']) testFrameworks.push('Playwright');
        if (dependencies['@testing-library/react'] || dependencies['@testing-library/vue']) {
          testFrameworks.push('Testing Library');
        }
        if (dependencies.enzyme) testFrameworks.push('Enzyme');
        if (dependencies.puppeteer) testFrameworks.push('Puppeteer');
        
        if (testFrameworks.length > 0) {
          this.emit('log', { level: 'info', message: `Test Agent detected frameworks: ${testFrameworks.join(', ')}` });
        }
      }

      // Check for test configuration files
      const configFiles = [];
      const files: string[] = await fs.readdir(this.config.workspaceDir!).catch(() => []);
      
      if (files.some((f: string) => f.startsWith('jest.config'))) configFiles.push('Jest config');
      if (files.some((f: string) => f.startsWith('vitest.config'))) configFiles.push('Vitest config');
      if (files.some((f: string) => f.startsWith('cypress.config'))) configFiles.push('Cypress config');
      if (files.some((f: string) => f.startsWith('playwright.config'))) configFiles.push('Playwright config');
      if (files.includes('.mocharc.json') || files.includes('.mocharc.js')) configFiles.push('Mocha config');
      
      if (configFiles.length > 0) {
        this.emit('log', { level: 'info', message: `Test Agent detected configs: ${configFiles.join(', ')}` });
      }

      // Check for existing test directories
      const testDirs = [];
      const testPaths = ['test', 'tests', '__tests__', 'spec', 'cypress', 'e2e'];
      
      for (const testPath of testPaths) {
        const fullPath = path.join(this.config.workspaceDir!, testPath);
        const exists = await fs.access(fullPath).then(() => true).catch(() => false);
        if (exists) {
          const stat = await fs.stat(fullPath);
          if (stat.isDirectory()) {
            testDirs.push(testPath);
          }
        }
      }
      
      if (testDirs.length > 0) {
        this.emit('log', { level: 'info', message: `Test Agent found test directories: ${testDirs.join(', ')}` });
      }
    } catch (error) {
      this.emit('log', { level: 'warn', message: `Failed to detect test environment: ${error}` });
    }
  }

  public async canHandle(task: Task): Promise<boolean> {
    // Check if task is testing-related
    const testKeywords = [
      'test', 'testing', 'spec', 'unit', 'integration', 'e2e', 'end-to-end',
      'jest', 'vitest', 'mocha', 'cypress', 'playwright', 'coverage',
      'quality', 'qa', 'validation', 'verification', 'assertion',
      'mock', 'stub', 'spy', 'fixture', 'snapshot', 'regression',
      'performance', 'load', 'stress', 'accessibility', 'a11y',
      'security', 'vulnerability', 'penetration'
    ];

    const taskDescription = task.description.toLowerCase();
    const hasKeyword = testKeywords.some(keyword => taskDescription.includes(keyword));

    // Check task type
    const testTypes = ['testing', 'security', 'analysis'];
    const isTestType = testTypes.includes(task.type);

    // Check for test-related file patterns in deliverables
    const testPatterns = [
      '.test.', '.spec.', '__tests__', 'cypress', 'e2e',
      'test/', 'tests/', 'spec/', 'coverage'
    ];
    const hasTestFiles = task.deliverables.some(deliverable => 
      testPatterns.some(pattern => deliverable.includes(pattern))
    );

    // Check required skills
    const testSkills = [
      'testing', 'quality assurance', 'test automation', 'performance testing',
      'security testing', 'accessibility testing', 'unit testing',
      'integration testing', 'end-to-end testing'
    ];
    const hasTestSkills = task.requiredSkills.some(skill => 
      testSkills.some(testSkill => skill.toLowerCase().includes(testSkill))
    );

    return hasKeyword || isTestType || hasTestFiles || hasTestSkills;
  }

  protected buildTaskPrompt(task: Task): string {
    const context = super.buildTaskPrompt(task);
    
    return `${context}

Test Engineering Context:
- Follow the test pyramid: prioritize unit tests, then integration, then e2e
- Write tests that are fast, reliable, and maintainable
- Focus on testing behavior and user interactions, not implementation details
- Use descriptive test names that explain the expected behavior
- Implement proper test isolation with setup/teardown
- Include both positive and negative test cases
- Test error conditions and edge cases thoroughly
- Ensure tests serve as living documentation
- Maintain high code coverage while avoiding brittle tests
- Use appropriate test doubles (mocks, stubs, spies) judiciously

Testing Strategy:
1. Analyze the code to understand what needs testing
2. Design a comprehensive test plan covering all scenarios
3. Implement tests starting with the most critical paths
4. Ensure proper test data management and cleanup
5. Validate accessibility, performance, and security requirements
6. Set up continuous integration for automated test execution

Always prioritize test quality and maintainability over quantity.`;
  }
}