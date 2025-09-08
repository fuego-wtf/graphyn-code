/**
 * T016: Approval workflow keyboard navigation integration test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SplitScreenOrchestrator } from '../../src/cli/enhanced-ux/split-screen-orchestrator.js';

describe('Approval Workflow Integration Tests', () => {
  let orchestrator: SplitScreenOrchestrator;

  beforeEach(async () => {
    orchestrator = new SplitScreenOrchestrator();
    await orchestrator.initialize({ enableResize: false, persistState: false, debugMode: false });
  });

  afterEach(async () => {
    await orchestrator.cleanup();
  });

  it('should handle approval workflow with keyboard navigation', async () => {
    // Create mock task decomposition
    const mockTasks = [
      { id: 'task-1', title: 'Setup API', assignedAgent: 'backend', estimatedDuration: 300 },
      { id: 'task-2', title: 'Create UI', assignedAgent: 'frontend', estimatedDuration: 240 }
    ];

    await orchestrator.startApprovalWorkflow('test query', mockTasks);

    // Simulate keyboard navigation
    await orchestrator.handleKeyPress('down', { ctrl: false, alt: false, shift: false, meta: false });
    await orchestrator.handleKeyPress(' ', { ctrl: false, alt: false, shift: false, meta: false }); // Select
    await orchestrator.handleKeyPress('a', { ctrl: false, alt: false, shift: false, meta: false }); // Approve

    const workflow = orchestrator.getCurrentWorkflow();
    expect(workflow?.status).toBe('approved');
  });
});