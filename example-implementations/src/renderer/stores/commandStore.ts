import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CommandState {
  commandHistory: string[];
  executeCommand: (command: string, agentId?: string) => Promise<void>;
  clearHistory: () => void;
}

export const useCommandStore = create<CommandState>()(
  persist(
    (set, get) => ({
      commandHistory: [],
      
      executeCommand: async (command: string, agentId?: string) => {
        // Add command to history
        set((state) => ({
          commandHistory: [...state.commandHistory, command].slice(-50) // Keep last 50 commands
        }));
        
        // Here you would implement the actual command execution logic
        // For now, we'll just simulate it
        console.log('Executing command:', command, 'with agent:', agentId);
        
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 1000));
      },
      
      clearHistory: () => set({ commandHistory: [] })
    }),
    {
      name: 'command-history',
      partialize: (state) => ({ commandHistory: state.commandHistory }) // Only persist history
    }
  )
);