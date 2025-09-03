import React from 'react';
import { Circle, AlertCircle, Loader2 } from 'lucide-react';
import { Agent } from '../../../shared/types';
import { cn } from '../../utils/cn';

interface AgentItemProps {
  agent: Agent;
  isActive?: boolean;
  onClick: () => void;
}

const statusIcons = {
  active: Circle,
  inactive: Circle,
  error: AlertCircle,
  loading: Loader2
};

const statusColors = {
  active: 'text-green-500',
  inactive: 'text-gray-500',
  error: 'text-red-500',
  loading: 'text-blue-500'
};

export const AgentItem: React.FC<AgentItemProps> = ({ agent, isActive, onClick }) => {
  const StatusIcon = statusIcons[agent.status];
  const statusColor = statusColors[agent.status];

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
        "hover:bg-gray-800 group",
        isActive && "bg-gray-800 shadow-sm",
        "text-left"
      )}
    >
      {/* Status Indicator */}
      <div className="relative">
        <StatusIcon 
          className={cn(
            "w-4 h-4",
            statusColor,
            agent.status === 'loading' && "animate-spin"
          )} 
        />
        {agent.status === 'active' && (
          <div className={cn(
            "absolute inset-0 w-4 h-4 rounded-full animate-ping",
            "bg-green-500 opacity-20"
          )} />
        )}
      </div>

      {/* Agent Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            "font-medium text-sm truncate",
            isActive ? "text-white" : "text-gray-200"
          )}>
            {agent.displayName}
          </span>
          {agent.scope && (
            <span className="text-xs text-gray-500 shrink-0">
              {agent.scope}
            </span>
          )}
        </div>
        {agent.description && (
          <p className="text-xs text-gray-500 truncate mt-0.5">
            {agent.description}
          </p>
        )}
      </div>

      {/* Type Badge */}
      <div className={cn(
        "px-2 py-0.5 rounded text-xs font-medium shrink-0",
        "transition-opacity",
        isActive || "opacity-60 group-hover:opacity-100",
        agent.type === 'agent' && "bg-purple-500/20 text-purple-400",
        agent.type === 'project' && "bg-blue-500/20 text-blue-400",
        agent.type === 'global' && "bg-orange-500/20 text-orange-400"
      )}>
        {agent.type}
      </div>
    </button>
  );
};