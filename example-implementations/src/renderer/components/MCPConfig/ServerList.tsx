import React, { useState } from 'react';
import { Plus, Settings } from 'lucide-react';
import { MCPServer } from '../../../shared/types';
import { ServerCard } from './ServerCard';
import { AddServerModal } from './AddServerModal';
import { Button } from '../ui/button';

interface ServerListProps {
  servers: MCPServer[];
  onToggleServer: (serverId: string, enabled: boolean) => void;
  onAddServer: (server: Omit<MCPServer, 'id' | 'status'>) => void;
  onRemoveServer: (serverId: string) => void;
  onUpdateServerConfig: (serverId: string, config: Partial<MCPServer['config']>) => void;
}

export const ServerList: React.FC<ServerListProps> = ({
  servers,
  onToggleServer,
  onAddServer,
  onRemoveServer,
  onUpdateServerConfig
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);

  const handleAddServer = (serverData: Omit<MCPServer, 'id' | 'status'>) => {
    onAddServer(serverData);
    setIsAddModalOpen(false);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">MCP Servers</h2>
        <p className="text-gray-400">
          MCP settings apply to all instances of Claude Code.
        </p>
      </div>

      {/* Server List */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">MCP Servers</h3>
          <Button
            onClick={() => setIsAddModalOpen(true)}
            variant="secondary"
            size="sm"
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Click to enable
          </Button>
        </div>

        {servers.length === 0 ? (
          <div className="text-center py-12 bg-gray-800/50 rounded-lg border border-gray-700">
            <Settings className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-400">No MCP servers configured</p>
            <p className="text-gray-500 text-sm mt-1">
              Click "Add Server" to get started
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {servers.map(server => (
              <ServerCard
                key={server.id}
                server={server}
                onToggle={onToggleServer}
                onRemove={() => onRemoveServer(server.id)}
                onConfigure={() => setSelectedServerId(server.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Custom Server Section */}
      <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
        <h3 className="text-white font-semibold mb-3">
          Want to add a custom MCP server? Run:
        </h3>
        <div className="bg-gray-900 rounded-md p-4 font-mono text-sm">
          <code className="text-green-400">
            claude mcp add my-user-server -s user /path/to/server
          </code>
        </div>
        <p className="text-gray-400 text-sm mt-3">
          Learn more in the{' '}
          <a href="#" className="text-blue-400 hover:underline">
            Claude Code docs
          </a>
          .
        </p>
      </div>

      {/* Add Server Modal */}
      <AddServerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddServer}
      />
    </div>
  );
};