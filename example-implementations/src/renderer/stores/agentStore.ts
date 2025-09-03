import { create } from 'zustand';
import { Agent } from '../../shared/types';

interface AgentState {
  agents: Agent[];
  activeAgentId: string | null;
  setActiveAgent: (agentId: string) => void;
  updateAgentStatus: (agentId: string, status: Agent['status']) => void;
  addAgent: (agent: Agent) => void;
  removeAgent: (agentId: string) => void;
}

// Sample initial agents
const initialAgents: Agent[] = [
  {
    id: '1',
    name: 'fullstack-sprint-executor',
    displayName: 'fullstack-sprint-executor',
    type: 'agent',
    status: 'active',
    color: 'purple',
    scope: 'project',
    description: 'Executes full-stack development sprints'
  },
  {
    id: '2',
    name: 'production-architect',
    displayName: 'production-architect',
    type: 'agent',
    status: 'active',
    color: 'purple',
    scope: 'project',
    description: 'Designs production architecture'
  },
  {
    id: '3',
    name: 'pr-merger',
    displayName: 'pr-merger',
    type: 'agent',
    status: 'active',
    color: 'blue',
    scope: 'project',
    description: 'Handles pull request merging'
  },
  {
    id: '4',
    name: 'github-project-analyzer',
    displayName: 'github-project-analyzer',
    type: 'agent',
    status: 'inactive',
    color: 'yellow',
    scope: 'project',
    description: 'Analyzes GitHub projects'
  },
  {
    id: '5',
    name: 'graphyn-platform-architect',
    displayName: 'graphyn-platform-architect',
    type: 'agent',
    status: 'active',
    color: 'green',
    scope: 'project',
    description: 'Architects Graphyn platform'
  },
  {
    id: '6',
    name: 'test-writer',
    displayName: 'test-writer',
    type: 'agent',
    status: 'inactive',
    color: 'orange',
    scope: 'project',
    description: 'Writes automated tests'
  },
  {
    id: '7',
    name: 'task-dispatcher',
    displayName: 'task-dispatcher',
    type: 'agent',
    status: 'active',
    color: 'blue',
    scope: 'project',
    description: 'Dispatches tasks to other agents'
  },
  {
    id: '8',
    name: 'code-cli-developer',
    displayName: 'code-cli-developer',
    type: 'agent',
    status: 'active',
    color: 'red',
    scope: 'project',
    description: 'Develops CLI tools'
  },
  {
    id: '9',
    name: 'figma-to-code',
    displayName: 'figma-to-code',
    type: 'agent',
    status: 'inactive',
    color: 'blue',
    scope: 'project',
    description: 'Converts Figma designs to code'
  },
  {
    id: '10',
    name: 'mcp-protocol-expert',
    displayName: 'mcp-protocol-expert',
    type: 'agent',
    status: 'active',
    color: 'blue',
    scope: 'global',
    description: 'Expert in MCP protocol implementation'
  }
];

export const useAgentStore = create<AgentState>((set) => ({
  agents: initialAgents,
  activeAgentId: null,
  
  setActiveAgent: (agentId) => set({ activeAgentId: agentId }),
  
  updateAgentStatus: (agentId, status) => set((state) => ({
    agents: state.agents.map(agent =>
      agent.id === agentId ? { ...agent, status } : agent
    )
  })),
  
  addAgent: (agent) => set((state) => ({
    agents: [...state.agents, agent]
  })),
  
  removeAgent: (agentId) => set((state) => ({
    agents: state.agents.filter(agent => agent.id !== agentId),
    activeAgentId: state.activeAgentId === agentId ? null : state.activeAgentId
  }))
}));