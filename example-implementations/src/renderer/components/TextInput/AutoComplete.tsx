import React, { useState, useEffect, useRef } from 'react';
import { Agent } from '../../../shared/types';
import { cn } from '../../utils/cn';

interface AutoCompleteProps {
  agents: Agent[];
  searchQuery: string;
  onSelect: (agent: Agent) => void;
  onClose: () => void;
}

export const AutoComplete: React.FC<AutoCompleteProps> = ({
  agents,
  searchQuery,
  onSelect,
  onClose
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Filter agents based on search query
  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : filteredAgents.length - 1
          );
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < filteredAgents.length - 1 ? prev + 1 : 0
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredAgents[selectedIndex]) {
            onSelect(filteredAgents[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredAgents, selectedIndex, onSelect, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedItem = itemRefs.current[selectedIndex];
    if (selectedItem && listRef.current) {
      const listRect = listRef.current.getBoundingClientRect();
      const itemRect = selectedItem.getBoundingClientRect();
      
      if (itemRect.bottom > listRect.bottom) {
        selectedItem.scrollIntoView({ block: 'end', behavior: 'smooth' });
      } else if (itemRect.top < listRect.top) {
        selectedItem.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  // Reset selected index when filtered agents change
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  if (filteredAgents.length === 0) {
    return (
      <div className="absolute left-0 right-0 mt-2 p-4 bg-gray-800 rounded-lg border border-gray-700 shadow-xl">
        <p className="text-gray-500 text-sm text-center">No agents found</p>
      </div>
    );
  }

  return (
    <div 
      ref={listRef}
      className="absolute left-0 right-0 mt-2 max-h-64 overflow-y-auto bg-gray-800 
                rounded-lg border border-gray-700 shadow-xl z-50"
    >
      <div className="p-2">
        <div className="text-xs text-gray-500 px-2 py-1 uppercase tracking-wider">
          Select Agent
        </div>
        {filteredAgents.map((agent, index) => (
          <div
            key={agent.id}
            ref={el => itemRefs.current[index] = el}
            onClick={() => onSelect(agent)}
            onMouseEnter={() => setSelectedIndex(index)}
            className={cn(
              "px-3 py-2 rounded-md cursor-pointer transition-colors",
              "flex items-center justify-between",
              index === selectedIndex
                ? "bg-blue-600 text-white"
                : "hover:bg-gray-700 text-gray-200"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-2 h-2 rounded-full",
                `bg-${agent.color}-500`
              )} />
              <div>
                <div className="font-medium text-sm">{agent.displayName}</div>
                <div className={cn(
                  "text-xs",
                  index === selectedIndex ? "text-blue-200" : "text-gray-500"
                )}>
                  @{agent.name} · {agent.type}
                </div>
              </div>
            </div>
            {agent.status === 'active' && (
              <div className={cn(
                "text-xs",
                index === selectedIndex ? "text-blue-200" : "text-green-500"
              )}>
                Active
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="border-t border-gray-700 px-4 py-2">
        <p className="text-xs text-gray-500">
          Use <kbd className="px-1 py-0.5 bg-gray-700 rounded">↑↓</kbd> to navigate, 
          <kbd className="px-1 py-0.5 bg-gray-700 rounded ml-1">Enter</kbd> to select
        </p>
      </div>
    </div>
  );
};