import React from 'react';
import { Trash2, Settings, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { MCPServer } from '../../../shared/types';
import { Switch } from '../ui/switch';
import { cn } from '../../utils/cn';

interface ServerCardProps {
  server: MCPServer;
  onToggle: (serverId: string, enabled: boolean) => void;
  onRemove: () => void;
  onConfigure: () => void;
}

const statusIcons = {
  connected: CheckCircle,
  disconnected: XCircle,
  connecting: Loader2,
  error: XCircle
};

const statusColors = {
  connected: 'text-green-500',
  disconnected: 'text-gray-500',
  connecting: 'text-blue-500',
  error: 'text-red-500'
};

export const ServerCard: React.FC<ServerCardProps> = ({
  server,
  onToggle,
  onRemove,
  onConfigure
}) => {
  const StatusIcon = statusIcons[server.status.state];
  const statusColor = statusColors[server.status.state];

  // Server icons mapping
  const serverIcons: Record<string, string> = {
    Linear: '🔗',
    Figma: '🎨',
    Context7: '🔍',
    Sentry: '🐛'
  };

  return (
    <div className={cn(
      "flex items-center justify-between p-4 rounded-lg",
      "bg-gray-800/80 border border-gray-700",
      "hover:border-gray-600 transition-all"
    )}>
      <div className="flex items-center gap-4">
        {/* Server Icon */}
        <div className="text-2xl">
          {serverIcons[server.name] || server.icon || '📦'}
        </div>

        {/* Server Info */}
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-white font-medium">{server.displayName}</h4>
            <StatusIcon 
              className={cn(
                "w-4 h-4",
                statusColor,
                server.status.state === 'connecting' && "animate-spin"
              )} 
            />
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className={cn(
              "text-xs uppercase tracking-wider font-medium",
              server.enabled ? "text-green-400" : "text-gray-500"
            )}>
              {server.enabled ? 'ENABLED' : 'DISABLED'}
            </span>
            {server.status.state === 'error' && server.status.errorMessage && (
              <span className="text-xs text-red-400">
                {server.status.errorMessage}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={onConfigure}
          className="p-2 rounded-md hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          title="Configure server"
        >
          <Settings className="w-4 h-4" />
        </button>
        
        <button
          onClick={onRemove}
          className="p-2 rounded-md hover:bg-gray-700 text-gray-400 hover:text-red-400 transition-colors"
          title="Remove server"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <Switch
          checked={server.enabled}
          onCheckedChange={(checked) => onToggle(server.id, checked)}
          className="ml-2"
        />
      </div>
    </div>
  );
};