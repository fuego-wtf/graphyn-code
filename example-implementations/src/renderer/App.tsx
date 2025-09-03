import React, { useState } from 'react';
import { AgentList } from './components/AgentList/AgentList';
import { CommandInput } from './components/TextInput/CommandInput';
import { ServerList } from './components/MCPConfig/ServerList';
import { Agent, MCPServer, UIState } from '../shared/types';
import { useAgentStore } from './stores/agentStore';
import { useMCPStore } from './stores/mcpStore';
import { useCommandStore } from './stores/commandStore';

function App() {
  const [activeView, setActiveView] = useState<'agents' | 'mcp'>('agents');
  
  // Store hooks
  const { agents, activeAgentId, setActiveAgent } = useAgentStore();
  const { servers, toggleServer, addServer, removeServer, updateServerConfig } = useMCPStore();
  const { commandHistory, executeCommand } = useCommandStore();

  const handleAgentClick = (agent: Agent) => {
    setActiveAgent(agent.id);
  };

  const handleSendCommand = async (command: string, agentId?: string) => {
    await executeCommand(command, agentId);
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-gray-950 border-r border-gray-800 flex flex-col">
        {/* App Title */}
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-xl font-bold text-white">Graphyn Desktop</h1>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-800">
          <button
            onClick={() => setActiveView('agents')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeView === 'agents'
                ? 'text-white bg-gray-800 border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            Agents
          </button>
          <button
            onClick={() => setActiveView('mcp')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeView === 'mcp'
                ? 'text-white bg-gray-800 border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            MCP Servers
          </button>
        </div>

        {/* Agent List (shown when agents tab is active) */}
        {activeView === 'agents' && (
          <AgentList
            agents={agents}
            activeAgentId={activeAgentId}
            onAgentClick={handleAgentClick}
            className="flex-1"
          />
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Content Area */}
        <div className="flex-1 overflow-auto">
          {activeView === 'agents' ? (
            <div className="p-8">
              <h2 className="text-2xl font-bold text-white mb-4">
                Agent Workspace
              </h2>
              <p className="text-gray-400 mb-8">
                Select an agent from the sidebar and use the command input below to interact with it.
              </p>
              
              {/* Agent Details */}
              {activeAgentId && agents.find(a => a.id === activeAgentId) && (
                <div className="bg-gray-800 rounded-lg p-6 mb-8">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Active Agent: {agents.find(a => a.id === activeAgentId)?.displayName}
                  </h3>
                  <p className="text-gray-400">
                    {agents.find(a => a.id === activeAgentId)?.description || 'No description available'}
                  </p>
                </div>
              )}

              {/* Command History */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Recent Commands</h3>
                {commandHistory.length === 0 ? (
                  <p className="text-gray-500">No commands executed yet</p>
                ) : (
                  <div className="space-y-2">
                    {commandHistory.slice(-5).reverse().map((cmd, index) => (
                      <div key={index} className="bg-gray-800 rounded p-3">
                        <p className="text-sm text-white font-mono">{cmd}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <ServerList
              servers={servers}
              onToggleServer={toggleServer}
              onAddServer={addServer}
              onRemoveServer={removeServer}
              onUpdateServerConfig={updateServerConfig}
            />
          )}
        </div>

        {/* Command Input (only shown for agents view) */}
        {activeView === 'agents' && (
          <div className="border-t border-gray-800 p-4">
            <CommandInput
              agents={agents}
              onSendCommand={handleSendCommand}
              commandHistory={commandHistory}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;