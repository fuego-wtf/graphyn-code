/**
 * Unit Tests for TerminalLayout Entity
 * 
 * These tests define the behavior for terminal layout calculations and region management.
 * They MUST FAIL initially before entity implementation (TDD Red phase).
 */

import { describe, it, expect } from 'vitest';
import type { TerminalDimensions, LayoutRegions } from '../../../src/cli/enhanced-ux/types.js';

// This import WILL FAIL initially - that's the point of TDD
import { TerminalLayout } from '../../../src/cli/enhanced-ux/entities/terminal-layout.js';

describe('TerminalLayout Entity', () => {
  describe('Construction', () => {
    it('should create terminal layout with valid dimensions', () => {
      const dimensions: TerminalDimensions = { width: 120, height: 40 };
      const layout = new TerminalLayout(dimensions);
      
      expect(layout.dimensions).toEqual(dimensions);
      expect(layout.isValid()).toBe(true);
    });

    it('should reject invalid dimensions', () => {
      const invalidDimensions: TerminalDimensions = { width: 0, height: 0 };
      
      expect(() => new TerminalLayout(invalidDimensions)).toThrow('Invalid terminal dimensions');
    });

    it('should apply minimum dimension constraints', () => {
      const tinyDimensions: TerminalDimensions = { width: 5, height: 3 };
      const layout = new TerminalLayout(tinyDimensions);
      
      // Should enforce minimum constraints
      expect(layout.dimensions.width).toBeGreaterThanOrEqual(10);
      expect(layout.dimensions.height).toBeGreaterThanOrEqual(6);
    });
  });

  describe('Region Calculation', () => {
    it('should calculate default 70/20/10 layout regions', () => {
      const dimensions: TerminalDimensions = { width: 120, height: 40 };
      const layout = new TerminalLayout(dimensions);
      const regions = layout.calculateRegions();
      
      // Verify region properties
      expect(regions).toHaveProperty('streaming');
      expect(regions).toHaveProperty('approval');
      expect(regions).toHaveProperty('input');
      
      // Verify proportions (70%, 20%, 10%)
      const totalHeight = dimensions.height;
      expect(regions.streaming.height).toBe(Math.floor(totalHeight * 0.7));
      expect(regions.approval.height).toBe(Math.floor(totalHeight * 0.2));
      expect(regions.input.height).toBe(Math.floor(totalHeight * 0.1));
      
      // Verify positioning
      expect(regions.streaming.y).toBe(0);
      expect(regions.approval.y).toBe(regions.streaming.height);
      expect(regions.input.y).toBe(regions.streaming.height + regions.approval.height);
      
      // Verify full width usage
      expect(regions.streaming.width).toBe(dimensions.width);
      expect(regions.approval.width).toBe(dimensions.width);
      expect(regions.input.width).toBe(dimensions.width);
    });

    it('should handle custom layout ratios', () => {
      const dimensions: TerminalDimensions = { width: 100, height: 30 };
      const customRatios = { streaming: 0.6, approval: 0.3, input: 0.1 };
      const layout = new TerminalLayout(dimensions, customRatios);
      const regions = layout.calculateRegions();
      
      expect(regions.streaming.height).toBe(Math.floor(30 * 0.6)); // 18
      expect(regions.approval.height).toBe(Math.floor(30 * 0.3)); // 9
      expect(regions.input.height).toBe(Math.floor(30 * 0.1)); // 3
    });

    it('should ensure regions cover entire terminal height', () => {
      const dimensions: TerminalDimensions = { width: 80, height: 25 };
      const layout = new TerminalLayout(dimensions);
      const regions = layout.calculateRegions();
      
      const totalRegionHeight = regions.streaming.height + regions.approval.height + regions.input.height;
      
      // Should be equal or at most 1 less due to rounding
      expect(totalRegionHeight).toBeGreaterThanOrEqual(dimensions.height - 1);
      expect(totalRegionHeight).toBeLessThanOrEqual(dimensions.height);
    });

    it('should handle minimum region size constraints', () => {
      const smallDimensions: TerminalDimensions = { width: 20, height: 6 };
      const layout = new TerminalLayout(smallDimensions);
      const regions = layout.calculateRegions();
      
      // Each region should have at least 1 line
      expect(regions.streaming.height).toBeGreaterThanOrEqual(1);
      expect(regions.approval.height).toBeGreaterThanOrEqual(1);
      expect(regions.input.height).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Region Updates', () => {
    it('should update streaming region bounds', () => {
      const layout = new TerminalLayout({ width: 100, height: 30 });
      const newStreamingBounds = { x: 0, y: 0, width: 100, height: 20 };
      
      layout.updateStreamingRegion(newStreamingBounds);
      const regions = layout.calculateRegions();
      
      expect(regions.streaming).toEqual(newStreamingBounds);
    });

    it('should update approval region bounds', () => {
      const layout = new TerminalLayout({ width: 100, height: 30 });
      const newApprovalBounds = { x: 0, y: 20, width: 100, height: 8 };
      
      layout.updateApprovalRegion(newApprovalBounds);
      const regions = layout.calculateRegions();
      
      expect(regions.approval).toEqual(newApprovalBounds);
    });

    it('should update input region bounds', () => {
      const layout = new TerminalLayout({ width: 100, height: 30 });
      const newInputBounds = { x: 0, y: 28, width: 100, height: 2 };
      
      layout.updateInputRegion(newInputBounds);
      const regions = layout.calculateRegions();
      
      expect(regions.input).toEqual(newInputBounds);
    });

    it('should validate region bounds updates', () => {
      const layout = new TerminalLayout({ width: 100, height: 30 });
      
      // Invalid bounds (outside terminal)
      const invalidBounds = { x: 0, y: 0, width: 200, height: 50 };
      
      expect(() => layout.updateStreamingRegion(invalidBounds))
        .toThrow('Region bounds exceed terminal dimensions');
    });
  });

  describe('Resize Handling', () => {
    it('should resize layout and recalculate regions', () => {
      const initialDimensions: TerminalDimensions = { width: 80, height: 24 };
      const layout = new TerminalLayout(initialDimensions);
      
      const newDimensions: TerminalDimensions = { width: 120, height: 40 };
      layout.resize(newDimensions);
      
      expect(layout.dimensions).toEqual(newDimensions);
      
      const regions = layout.calculateRegions();
      expect(regions.streaming.width).toBe(120);
      expect(regions.streaming.height).toBe(Math.floor(40 * 0.7));
    });

    it('should emit resize events', () => {
      const layout = new TerminalLayout({ width: 80, height: 24 });
      let resizeEventFired = false;
      let newRegions: LayoutRegions | null = null;
      
      layout.on('resize', (regions: LayoutRegions) => {
        resizeEventFired = true;
        newRegions = regions;
      });
      
      layout.resize({ width: 100, height: 30 });
      
      expect(resizeEventFired).toBe(true);
      expect(newRegions).not.toBeNull();
      expect(newRegions!.streaming.width).toBe(100);
    });

    it('should handle rapid resize events with debouncing', async () => {
      const layout = new TerminalLayout({ width: 80, height: 24 });
      let resizeEventCount = 0;
      
      layout.on('resize', () => {
        resizeEventCount++;
      });
      
      // Rapid resizes
      layout.resize({ width: 90, height: 25 });
      layout.resize({ width: 100, height: 26 });
      layout.resize({ width: 110, height: 27 });
      layout.resize({ width: 120, height: 28 });
      
      // Should debounce and only fire once
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(resizeEventCount).toBe(1);
    });
  });

  describe('Validation', () => {
    it('should validate layout consistency', () => {
      const layout = new TerminalLayout({ width: 100, height: 30 });
      
      expect(layout.isValid()).toBe(true);
      expect(layout.validateRegions()).toBe(true);
    });

    it('should detect invalid layout state', () => {
      const layout = new TerminalLayout({ width: 100, height: 30 });
      
      // Corrupt the layout state
      layout.updateStreamingRegion({ x: 0, y: 0, width: 100, height: 50 }); // Too tall
      
      expect(layout.isValid()).toBe(false);
      expect(() => layout.validateRegions()).toThrow('Invalid region configuration');
    });

    it('should provide validation error details', () => {
      const layout = new TerminalLayout({ width: 100, height: 30 });
      
      // Create overlapping regions
      layout.updateStreamingRegion({ x: 0, y: 0, width: 100, height: 20 });
      layout.updateApprovalRegion({ x: 0, y: 15, width: 100, height: 10 }); // Overlaps
      
      const validationResult = layout.getValidationErrors();
      expect(validationResult.length).toBeGreaterThan(0);
      expect(validationResult[0]).toContain('overlap');
    });
  });

  describe('Serialization', () => {
    it('should serialize layout to JSON', () => {
      const dimensions: TerminalDimensions = { width: 120, height: 40 };
      const layout = new TerminalLayout(dimensions);
      
      const json = layout.toJSON();
      
      expect(json).toHaveProperty('dimensions');
      expect(json).toHaveProperty('regions');
      expect(json).toHaveProperty('ratios');
      expect(json.dimensions).toEqual(dimensions);
    });

    it('should deserialize layout from JSON', () => {
      const originalLayout = new TerminalLayout({ width: 120, height: 40 });
      const json = originalLayout.toJSON();
      
      const deserializedLayout = TerminalLayout.fromJSON(json);
      
      expect(deserializedLayout.dimensions).toEqual(originalLayout.dimensions);
      expect(deserializedLayout.calculateRegions()).toEqual(originalLayout.calculateRegions());
    });

    it('should handle corrupted JSON gracefully', () => {
      const corruptedJson = { dimensions: null, regions: undefined };
      
      expect(() => TerminalLayout.fromJSON(corruptedJson as any))
        .toThrow('Invalid layout JSON');
    });
  });

  describe('Performance', () => {
    it('should calculate regions quickly for large terminals', () => {
      const largeDimensions: TerminalDimensions = { width: 500, height: 200 };
      const layout = new TerminalLayout(largeDimensions);
      
      const startTime = performance.now();
      const regions = layout.calculateRegions();
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(1); // Less than 1ms
      expect(regions).toBeDefined();
    });

    it('should handle frequent resize operations efficiently', () => {
      const layout = new TerminalLayout({ width: 80, height: 24 });
      
      const startTime = performance.now();
      
      // 100 resize operations
      for (let i = 0; i < 100; i++) {
        layout.resize({ width: 80 + i, height: 24 + i });
      }
      
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(10); // Less than 10ms for 100 resizes
    });
  });
});