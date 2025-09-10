import { describe, it, expect, beforeEach } from 'vitest';
import { ExitProtectionState } from '../../../src/cli/enhanced-ux/entities/exit-protection-state.js';
describe('ExitProtectionState Entity Tests', () => {
    let exitState;
    let mockSessions;
    beforeEach(() => {
        mockSessions = [
            { agentType: 'backend', taskId: 'task-1', estimatedRemaining: 300, canInterrupt: true },
            { agentType: 'frontend', taskId: 'task-2', estimatedRemaining: 120, canInterrupt: false }
        ];
        exitState = new ExitProtectionState(mockSessions);
    });
    it('should initialize with normal status', () => {
        expect(exitState.status).toBe('normal');
        expect(exitState.activeSessions).toEqual(mockSessions);
    });
    it('should start confirmation process', () => {
        exitState.startConfirmation();
        expect(exitState.status).toBe('confirmation_pending');
        expect(exitState.autoConfirmTimer).toBeDefined();
    });
    it('should force exit', () => {
        exitState.forceExit();
        expect(exitState.status).toBe('force_exit');
    });
});
//# sourceMappingURL=exit-protection-state.test.js.map