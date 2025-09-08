/**
 * T011: ApprovalWorkflow entity tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ApprovalWorkflow } from '../../../src/cli/enhanced-ux/entities/approval-workflow.js';
import type { ApprovalStatus, ApprovalAction } from '../../../src/cli/enhanced-ux/types.js';

describe('ApprovalWorkflow Entity Tests', () => {
  let workflow: ApprovalWorkflow;

  beforeEach(() => {
    workflow = new ApprovalWorkflow('decomp-123', ['task-1', 'task-2', 'task-3'], 600);
  });

  it('should initialize with pending status', () => {
    expect(workflow.status).toBe('pending');
    expect(workflow.decompositionId).toBe('decomp-123');
    expect(workflow.estimatedExecutionTime).toBe(600);
  });

  it('should select and deselect tasks', () => {
    workflow.selectTask('task-1');
    expect(workflow.isTaskSelected('task-1')).toBe(true);
    
    workflow.deselectTask('task-1');
    expect(workflow.isTaskSelected('task-1')).toBe(false);
  });

  it('should approve workflow', () => {
    workflow.selectTask('task-1');
    workflow.approve();
    
    expect(workflow.status).toBe('approved');
    expect(workflow.approvedAt).toBeInstanceOf(Date);
  });
});