import React, { useState, useMemo } from 'react';
import { Search, Filter } from 'lucide-react';
import { Agent } from '../../../shared/types';
import { AgentItem } from './AgentItem';
import { cn } from '../../utils/cn';

interface AgentListProps {
  agents: Agent[];
  activeAgentId?: string;
  onAgentClick: (agent: Agent) => void;
  className?: string;
}

export const AgentList: React.FC<AgentListProps> = ({
  agents,
  activeAgentId,
  onAgentClick,
  className
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | Agent['type']>('all');

  const filteredAgents = useMemo(() => {
    return agents.filter(agent => {
      const matchesSearch = agent.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          agent.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || agent.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [agents, searchQuery, filterType]);

  const groupedAgents = useMemo(() => {
    const groups: Record<Agent['type'], Agent[]> = {
      agent: [],
      project: [],
      global: []
    };

    filteredAgents.forEach(agent => {
      groups[agent.type].push(agent);
    });

    return groups;
  }, [filteredAgents]);

  return (
    <div className={cn("flex flex-col h-full bg-gray-900", className)}>
      {/* Search and Filter Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 text-gray-200 rounded-lg 
                     border border-gray-700 focus:border-blue-500 focus:outline-none
                     placeholder-gray-500 text-sm"
          />
        </div>
        
        <div className="flex gap-2">
          {(['all', 'agent', 'project', 'global'] as const).map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={cn(
                "px-3 py-1 text-xs rounded-md transition-colors",
                filterType === type
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              )}
            >
              {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto">
        {Object.entries(groupedAgents).map(([type, agentsInGroup]) => {
          if (agentsInGroup.length === 0) return null;

          return (
            <div key={type} className="mb-4">
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {type}s
              </div>
              <div className="space-y-1 px-2">
                {agentsInGroup.map(agent => (
                  <AgentItem
                    key={agent.id}
                    agent={agent}
                    isActive={agent.id === activeAgentId}
                    onClick={() => onAgentClick(agent)}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {filteredAgents.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <Filter className="w-8 h-8 mb-2" />
            <p className="text-sm">No agents found</p>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="p-3 border-t border-gray-800 text-xs text-gray-500">
        {filteredAgents.length} of {agents.length} agents
      </div>
    </div>
  );
};