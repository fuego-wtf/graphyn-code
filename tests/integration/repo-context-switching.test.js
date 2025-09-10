import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SplitScreenOrchestrator } from '../../src/cli/enhanced-ux/split-screen-orchestrator.js';
import { tmpdir } from 'os';
import { mkdir, writeFile, rm } from 'fs/promises';
import path from 'path';
describe('Repository Context Switching Integration Tests', () => {
    let orchestrator;
    let testDir1;
    let testDir2;
    beforeEach(async () => {
        orchestrator = new SplitScreenOrchestrator();
        await orchestrator.initialize({
            enableResize: false,
            persistState: false,
            debugMode: false
        });
        testDir1 = path.join(tmpdir(), `test-repo-1-${Date.now()}`);
        testDir2 = path.join(tmpdir(), `test-repo-2-${Date.now()}`);
        await mkdir(testDir1, { recursive: true });
        await mkdir(testDir2, { recursive: true });
        await writeFile(path.join(testDir1, 'package.json'), JSON.stringify({
            dependencies: { react: '^18.0.0' }
        }));
        await writeFile(path.join(testDir2, 'package.json'), JSON.stringify({
            dependencies: { express: '^4.0.0' }
        }));
    });
    afterEach(async () => {
        await orchestrator.cleanup();
        await rm(testDir1, { recursive: true, force: true });
        await rm(testDir2, { recursive: true, force: true });
    });
    it('should switch repository context and update agent prompts', async () => {
        await orchestrator.switchRepository(testDir1);
        const context1 = orchestrator.getCurrentRepositoryContext();
        expect(context1?.workingDirectory).toBe(testDir1);
        expect(context1?.fingerprint.techStack.dependencies).toContainEqual(expect.objectContaining({ name: 'react' }));
        await orchestrator.switchRepository(testDir2);
        const context2 = orchestrator.getCurrentRepositoryContext();
        expect(context2?.workingDirectory).toBe(testDir2);
        expect(context2?.fingerprint.techStack.dependencies).toContainEqual(expect.objectContaining({ name: 'express' }));
        const frontendPrompt1 = context1?.agentPrompts.get('frontend');
        const frontendPrompt2 = context2?.agentPrompts.get('frontend');
        expect(frontendPrompt1).not.toBe(frontendPrompt2);
    });
    it('should complete context switch within 3 seconds', async () => {
        const startTime = performance.now();
        await orchestrator.switchRepository(testDir1);
        const endTime = performance.now();
        expect(endTime - startTime).toBeLessThan(3000);
    });
});
//# sourceMappingURL=repo-context-switching.test.js.map