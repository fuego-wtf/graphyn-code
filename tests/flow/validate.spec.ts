import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import YAML from 'yaml';

describe('Delivery Flow Validation', () => {
  let flowData: any;
  let schema: any;
  let ajv: Ajv;

  beforeAll(async () => {
    // Load the generated flow
    const flowPath = path.join(process.cwd(), 'flows', 'delivery.flow.yaml');
    const flowContent = await fs.readFile(flowPath, 'utf-8');
    flowData = YAML.parse(flowContent);

    // Load the schema
    const schemaPath = path.join(process.cwd(), 'flows', 'schema.json');
    const schemaContent = await fs.readFile(schemaPath, 'utf-8');
    schema = JSON.parse(schemaContent);

    // Set up AJV validator
    ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
  });

  it('should have a valid flow file', async () => {
    expect(flowData).toBeDefined();
    expect(flowData.meta).toBeDefined();
    expect(flowData.segments).toBeDefined();
    expect(flowData.steps).toBeDefined();
  });

  it('should validate against the JSON schema', () => {
    const validate = ajv.compile(schema);
    const valid = validate(flowData);
    
    if (!valid) {
      console.error('Schema validation errors:', validate.errors);
    }
    
    expect(valid).toBe(true);
  });

  it('should have exactly 140 steps', () => {
    expect(flowData.steps).toHaveLength(140);
    expect(flowData.meta.total_steps).toBe(140);
  });

  it('should have 14 segments with 10 steps each', () => {
    expect(flowData.segments).toHaveLength(14);
    
    // Check that each segment has the right range
    const segmentCounts: Record<string, number> = {};
    flowData.steps.forEach((step: any) => {
      const segment = step.segment;
      segmentCounts[segment] = (segmentCounts[segment] || 0) + 1;
    });

    Object.values(segmentCounts).forEach(count => {
      expect(count).toBe(10);
    });
  });

  it('should have no duplicate step IDs', () => {
    const stepIds = flowData.steps.map((step: any) => step.id);
    const uniqueIds = new Set(stepIds);
    
    expect(stepIds.length).toBe(uniqueIds.size);
    expect(uniqueIds.size).toBe(140);
  });

  it('should have sequential step IDs from 1 to 140', () => {
    const stepIds = flowData.steps.map((step: any) => step.id).sort((a: number, b: number) => a - b);
    
    for (let i = 1; i <= 140; i++) {
      expect(stepIds[i - 1]).toBe(i);
    }
  });

  it('should have all required fields for each step', () => {
    flowData.steps.forEach((step: any, index: number) => {
      expect(step.id, `Step ${index + 1} should have id`).toBeDefined();
      expect(step.title, `Step ${index + 1} should have title`).toBeDefined();
      expect(step.description, `Step ${index + 1} should have description`).toBeDefined();
      expect(step.validations, `Step ${index + 1} should have validations`).toBeDefined();
      expect(step.rollback, `Step ${index + 1} should have rollback`).toBeDefined();
      expect(step.timeout, `Step ${index + 1} should have timeout`).toBeDefined();
      expect(step.retries, `Step ${index + 1} should have retries`).toBeDefined();
      expect(step.idempotency_key, `Step ${index + 1} should have idempotency_key`).toBeDefined();
      
      // Validate arrays
      expect(Array.isArray(step.validations), `Step ${index + 1} validations should be array`).toBe(true);
      expect(step.validations.length, `Step ${index + 1} should have at least one validation`).toBeGreaterThan(0);
      
      expect(Array.isArray(step.rollback), `Step ${index + 1} rollback should be array`).toBe(true);
      expect(step.rollback.length, `Step ${index + 1} should have at least one rollback`).toBeGreaterThan(0);
    });
  });

  it('should have valid segment assignments', () => {
    const validSegments = flowData.segments.map((s: any) => s.id);
    
    flowData.steps.forEach((step: any) => {
      expect(validSegments.includes(step.segment), 
        `Step ${step.id} has invalid segment: ${step.segment}`).toBe(true);
    });
  });

  it('should have unique idempotency keys', () => {
    const idempotencyKeys = flowData.steps.map((step: any) => step.idempotency_key);
    const uniqueKeys = new Set(idempotencyKeys);
    
    expect(idempotencyKeys.length).toBe(uniqueKeys.size);
  });

  it('should have proper timeout values', () => {
    flowData.steps.forEach((step: any) => {
      expect(step.timeout, `Step ${step.id} timeout should be positive`).toBeGreaterThan(0);
      expect(step.timeout, `Step ${step.id} timeout should be reasonable`).toBeLessThan(300000); // 5 minutes max
    });
  });

  it('should have valid retry counts', () => {
    flowData.steps.forEach((step: any) => {
      expect(step.retries, `Step ${step.id} retries should be non-negative`).toBeGreaterThanOrEqual(0);
      expect(step.retries, `Step ${step.id} retries should be reasonable`).toBeLessThanOrEqual(10);
    });
  });

  it('should have valid concurrency groups', () => {
    const validSegments = flowData.segments.map((s: any) => s.id);
    
    flowData.steps.forEach((step: any) => {
      expect(validSegments.includes(step.concurrency_group), 
        `Step ${step.id} has invalid concurrency group: ${step.concurrency_group}`).toBe(true);
    });
  });

  it('should have consistent segment mapping', () => {
    flowData.steps.forEach((step: any) => {
      const expectedSegmentIndex = Math.floor((step.id - 1) / 10);
      const expectedSegment = flowData.segments[expectedSegmentIndex];
      
      expect(step.segment, `Step ${step.id} should be in segment ${expectedSegment.id}`).toBe(expectedSegment.id);
      expect(step.concurrency_group, `Step ${step.id} concurrency group should match segment`).toBe(expectedSegment.id);
    });
  });

  it('should have proper validation structures', () => {
    flowData.steps.forEach((step: any) => {
      step.validations.forEach((validation: any, vIndex: number) => {
        expect(validation.type, 
          `Step ${step.id} validation ${vIndex} should have type`).toBeDefined();
        expect(validation.condition, 
          `Step ${step.id} validation ${vIndex} should have condition`).toBeDefined();
        
        const validTypes = ['file_exists', 'process_running', 'api_response', 'database_query', 'custom'];
        expect(validTypes.includes(validation.type), 
          `Step ${step.id} validation ${vIndex} has invalid type: ${validation.type}`).toBe(true);
      });
    });
  });

  it('should have proper rollback structures', () => {
    flowData.steps.forEach((step: any) => {
      step.rollback.forEach((rollback: any, rIndex: number) => {
        expect(rollback.type, 
          `Step ${step.id} rollback ${rIndex} should have type`).toBeDefined();
        expect(rollback.command, 
          `Step ${step.id} rollback ${rIndex} should have command`).toBeDefined();
        
        const validTypes = ['shell', 'file', 'process', 'database'];
        expect(validTypes.includes(rollback.type), 
          `Step ${step.id} rollback ${rIndex} has invalid type: ${rollback.type}`).toBe(true);
      });
    });
  });

  it('should have meaningful step titles', () => {
    flowData.steps.forEach((step: any) => {
      expect(step.title.length, `Step ${step.id} should have meaningful title`).toBeGreaterThan(10);
      expect(step.title, `Step ${step.id} title should not be placeholder`).not.toMatch(/TODO|FIXME|placeholder/i);
    });
  });

  it('should have tags for categorization', () => {
    flowData.steps.forEach((step: any) => {
      expect(Array.isArray(step.tags), `Step ${step.id} tags should be array`).toBe(true);
    });

    // Check that we have a good distribution of tags
    const allTags = new Set();
    flowData.steps.forEach((step: any) => {
      step.tags.forEach((tag: string) => allTags.add(tag));
    });

    expect(allTags.size, 'Should have diverse set of tags').toBeGreaterThan(5);
  });

  it('should have proper metadata', () => {
    expect(flowData.meta.name).toBe('Graphyn 140-Step Delivery Flow');
    expect(flowData.meta.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(flowData.meta.author).toBeDefined();
    expect(flowData.meta.created).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe('Flow Execution Readiness', () => {
  let flowData: any;

  beforeAll(async () => {
    const flowPath = path.join(process.cwd(), 'flows', 'delivery.flow.yaml');
    const flowContent = await fs.readFile(flowPath, 'utf-8');
    flowData = YAML.parse(flowContent);
  });

  it('should be ready for CLI runner execution', () => {
    // Check that all steps have the minimum required fields for execution
    flowData.steps.forEach((step: any) => {
      expect(step.id).toBeTypeOf('number');
      expect(step.title).toBeTypeOf('string');
      expect(step.idempotency_key).toBeTypeOf('string');
      expect(step.timeout).toBeTypeOf('number');
      expect(step.retries).toBeTypeOf('number');
      expect(step.validations.length).toBeGreaterThan(0);
      expect(step.rollback.length).toBeGreaterThan(0);
    });
  });

  it('should support resumability', () => {
    // Every step should have unique idempotency keys and proper preconditions
    const keys = new Set();
    flowData.steps.forEach((step: any) => {
      expect(keys.has(step.idempotency_key), 
        `Step ${step.id} idempotency key should be unique`).toBe(false);
      keys.add(step.idempotency_key);

      // Check preconditions (except first step)
      if (step.id > 1) {
        expect(Array.isArray(step.preconditions), 
          `Step ${step.id} should have preconditions array`).toBe(true);
      }
    });
  });

  it('should be segmented for partial execution', () => {
    // Check that segments are properly defined for range execution
    expect(flowData.segments.length).toBe(14);
    
    const segmentSteps: Record<string, number[]> = {};
    flowData.steps.forEach((step: any) => {
      if (!segmentSteps[step.segment]) {
        segmentSteps[step.segment] = [];
      }
      segmentSteps[step.segment].push(step.id);
    });

    // Each segment should have exactly 10 sequential steps
    Object.entries(segmentSteps).forEach(([segmentId, stepIds]) => {
      expect(stepIds.length, `Segment ${segmentId} should have 10 steps`).toBe(10);
      const sorted = stepIds.sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i] - sorted[i-1], 
          `Segment ${segmentId} should have sequential steps`).toBe(1);
      }
    });
  });
});