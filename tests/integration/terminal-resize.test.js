import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SplitScreenOrchestrator } from '../../src/cli/enhanced-ux/split-screen-orchestrator.js';
describe('Terminal Resize Integration Tests', () => {
    let orchestrator;
    beforeEach(async () => {
        orchestrator = new SplitScreenOrchestrator();
        await orchestrator.initialize({
            enableResize: true,
            persistState: true,
            debugMode: false
        });
    });
    afterEach(async () => {
        await orchestrator.cleanup();
    });
    it('should handle terminal resize gracefully', async () => {
        await orchestrator.setTerminalSize(80, 24);
        const initialLayout = orchestrator.getCurrentLayout();
        await orchestrator.setTerminalSize(120, 40);
        const newLayout = orchestrator.getCurrentLayout();
        expect(newLayout.width).toBe(120);
        expect(newLayout.height).toBe(40);
        expect(newLayout.regions.streamingOutput.height).toBeGreaterThan(initialLayout.regions.streamingOutput.height);
    });
    it('should preserve content during resize', async () => {
        await orchestrator.setTerminalSize(80, 24);
        await orchestrator.addStreamingContent({
            text: 'Important log message',
            timestamp: new Date()
        });
        await orchestrator.setTerminalSize(100, 30);
        const content = orchestrator.getStreamingContent();
        expect(content).toContain('Important log message');
    });
    it('should handle rapid resize events', async () => {
        const sizes = [
            [80, 24], [90, 30], [100, 35], [85, 25], [120, 40]
        ];
        for (const [width, height] of sizes) {
            await orchestrator.setTerminalSize(width, height);
            const layout = orchestrator.getCurrentLayout();
            expect(layout.width).toBe(width);
            expect(layout.height).toBe(height);
        }
    });
});
//# sourceMappingURL=terminal-resize.test.js.map