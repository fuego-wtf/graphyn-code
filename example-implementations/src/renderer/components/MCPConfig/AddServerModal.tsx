import React, { useState } from 'react';
import { X, Plus, Terminal } from 'lucide-react';
import { MCPServer } from '../../../shared/types';
import { Button } from '../ui/button';
import { cn } from '../../utils/cn';

interface AddServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (server: Omit<MCPServer, 'id' | 'status'>) => void;
}

export const AddServerModal: React.FC<AddServerModalProps> = ({
  isOpen,
  onClose,
  onAdd
}) => {
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    command: '',
    args: '',
    workingDirectory: '',
    transport: 'stdio' as MCPServer['config']['transport']
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const newErrors: Record<string, string> = {};
    
    if (!formData.name) {
      newErrors.name = 'Server name is required';
    }
    if (!formData.command) {
      newErrors.command = 'Command is required';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    // Create server object
    const newServer: Omit<MCPServer, 'id' | 'status'> = {
      name: formData.name,
      displayName: formData.displayName || formData.name,
      enabled: false,
      config: {
        command: formData.command,
        args: formData.args ? formData.args.split(' ') : [],
        workingDirectory: formData.workingDirectory || undefined,
        transport: formData.transport
      }
    };
    
    onAdd(newServer);
    
    // Reset form
    setFormData({
      name: '',
      displayName: '',
      command: '',
      args: '',
      workingDirectory: '',
      transport: 'stdio'
    });
    setErrors({});
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-xl font-semibold text-white">Add MCP Server</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Server Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Server Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={cn(
                "w-full px-3 py-2 bg-gray-800 border rounded-md",
                "text-white placeholder-gray-500",
                "focus:outline-none focus:ring-2 focus:ring-blue-500",
                errors.name ? "border-red-500" : "border-gray-700"
              )}
              placeholder="my-server"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md
                       text-white placeholder-gray-500
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="My Server"
            />
          </div>

          {/* Command */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Command *
            </label>
            <div className="relative">
              <Terminal className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={formData.command}
                onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                className={cn(
                  "w-full pl-10 pr-3 py-2 bg-gray-800 border rounded-md",
                  "text-white placeholder-gray-500 font-mono text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500",
                  errors.command ? "border-red-500" : "border-gray-700"
                )}
                placeholder="/path/to/server"
              />
            </div>
            {errors.command && (
              <p className="mt-1 text-sm text-red-500">{errors.command}</p>
            )}
          </div>

          {/* Arguments */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Arguments
            </label>
            <input
              type="text"
              value={formData.args}
              onChange={(e) => setFormData({ ...formData, args: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md
                       text-white placeholder-gray-500 font-mono text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="--port 3000 --host localhost"
            />
            <p className="mt-1 text-xs text-gray-500">
              Space-separated command line arguments
            </p>
          </div>

          {/* Working Directory */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Working Directory
            </label>
            <input
              type="text"
              value={formData.workingDirectory}
              onChange={(e) => setFormData({ ...formData, workingDirectory: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md
                       text-white placeholder-gray-500 font-mono text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="/home/user/projects"
            />
          </div>

          {/* Transport */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Transport Protocol
            </label>
            <select
              value={formData.transport}
              onChange={(e) => setFormData({ 
                ...formData, 
                transport: e.target.value as MCPServer['config']['transport'] 
              })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md
                       text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="stdio">Standard I/O (stdio)</option>
              <option value="http">HTTP</option>
              <option value="websocket">WebSocket</option>
            </select>
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-800">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Server
          </Button>
        </div>
      </div>
    </div>
  );
};