import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { useStore } from '../store.js';
import { useAPI } from '../hooks/useAPI.js';
import EventSource from 'eventsource';

interface AgentStream {
  agentId: string;
  agentName: string;
  threadId: string;
  status: 'connecting' | 'connected' | 'thinking' | 'responding' | 'done' | 'error';
  lastMessage?: string;
  progress?: number;
}

interface CollaborationProps {
  query: string;
  agents: string[];
}

export const AgentCollaboration: React.FC<CollaborationProps> = ({ query, agents }) => {
  const { reset } = useStore();
  const api = useAPI();
  const [streams, setStreams] = useState<AgentStream[]>([]);
  const [sessionId] = useState(`session-${Date.now()}`);
  const [overallStatus, setOverallStatus] = useState<'initializing' | 'running' | 'completed' | 'error'>('initializing');
  const [summary, setSummary] = useState<string>('');

  useEffect(() => {
    initializeCollaboration();
  }, []);

  const initializeCollaboration = async () => {
    try {
      // Create threads for each agent
      const agentStreams: AgentStream[] = [];
      
      for (const agent of agents) {
        const thread = await api.threads.create(`${agent}-${sessionId}`, 'testing');
        
        agentStreams.push({
          agentId: agent,
          agentName: agent.charAt(0).toUpperCase() + agent.slice(1),
          threadId: thread.id,
          status: 'connecting'
        });
      }
      
      setStreams(agentStreams);
      setOverallStatus('running');
      
      // Start SSE connections for each agent
      agentStreams.forEach((stream, index) => {
        connectToStream(stream, index);
      });
      
      // Send query to each agent
      setTimeout(() => {
        agentStreams.forEach(stream => {
          sendQueryToAgent(stream, query);
        });
      }, 1000);
    } catch (error) {
      setOverallStatus('error');
    }
  };

  const connectToStream = (stream: AgentStream, index: number) => {
    try {
      const eventSource = api.threads.stream(stream.threadId);
      
      eventSource.onopen = () => {
        updateStream(index, { status: 'connected' });
      };
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'thinking') {
            updateStream(index, { status: 'thinking' });
          } else if (data.type === 'message' && data.role === 'assistant') {
            updateStream(index, { 
              status: 'responding',
              lastMessage: data.content,
              progress: data.progress || 0
            });
          } else if (data.type === 'done') {
            updateStream(index, { status: 'done' });
            checkAllComplete();
          }
        } catch (err) {
          console.error('Failed to parse SSE message:', err);
        }
      };
      
      eventSource.onerror = () => {
        updateStream(index, { status: 'error' });
        eventSource.close();
      };
      
      // Store for cleanup
      (stream as any).eventSource = eventSource;
    } catch (error) {
      updateStream(index, { status: 'error' });
    }
  };

  const sendQueryToAgent = async (stream: AgentStream, query: string) => {
    try {
      await api.post(`/api/v1/threads/${stream.threadId}/messages`, {
        content: query,
        role: 'user',
        metadata: {
          sessionId,
          agentId: stream.agentId
        }
      });
    } catch (error) {
      console.error(`Failed to send query to ${stream.agentName}:`, error);
    }
  };

  const updateStream = (index: number, updates: Partial<AgentStream>) => {
    setStreams(prev => {
      const newStreams = [...prev];
      newStreams[index] = { ...newStreams[index], ...updates };
      return newStreams;
    });
  };

  const checkAllComplete = () => {
    setStreams(prev => {
      const allDone = prev.every(s => s.status === 'done' || s.status === 'error');
      if (allDone) {
        setOverallStatus('completed');
        generateSummary(prev);
      }
      return prev;
    });
  };

  const generateSummary = (streams: AgentStream[]) => {
    const responses = streams
      .filter(s => s.lastMessage)
      .map(s => `${s.agentName}: ${s.lastMessage}`)
      .join('\n\n');
    
    setSummary(`Multi-Agent Analysis Complete!\n\n${responses}`);
  };

  const getStatusIcon = (status: AgentStream['status']) => {
    switch (status) {
      case 'connecting': return <Spinner type="dots" />;
      case 'connected': return '🟢';
      case 'thinking': return '🤔';
      case 'responding': return '💬';
      case 'done': return '✅';
      case 'error': return '❌';
      default: return '⏳';
    }
  };

  const getStatusColor = (status: AgentStream['status']) => {
    switch (status) {
      case 'connected': return 'green';
      case 'thinking': return 'yellow';
      case 'responding': return 'cyan';
      case 'done': return 'green';
      case 'error': return 'red';
      default: return 'gray';
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>🤝 Multi-Agent Collaboration</Text>
      <Box marginTop={1}>
        <Text color="gray">Query: {query}</Text>
      </Box>
      
      <Box marginTop={2} flexDirection="column">
        <Text bold>Agent Status:</Text>
        
        {streams.map((stream, index) => (
          <Box key={stream.agentId} marginTop={1} flexDirection="column">
            <Box>
              <Box width={20}>
                <Text>{getStatusIcon(stream.status)} {stream.agentName} Agent</Text>
              </Box>
              <Text color={getStatusColor(stream.status)}>
                {stream.status === 'responding' && stream.progress 
                  ? `${Math.round(stream.progress * 100)}%`
                  : stream.status}
              </Text>
            </Box>
            
            {stream.lastMessage && (
              <Box marginLeft={3} marginTop={0}>
                <Text color="gray" wrap="truncate-end">
                  {stream.lastMessage.slice(0, 60)}...
                </Text>
              </Box>
            )}
          </Box>
        ))}
      </Box>
      
      {overallStatus === 'completed' && summary && (
        <Box marginTop={2} borderStyle="single" borderColor="green" padding={1}>
          <Box flexDirection="column">
            <Text bold color="green">✅ Collaboration Complete!</Text>
            <Box marginTop={1}>
              <Text wrap="wrap">{summary}</Text>
            </Box>
          </Box>
        </Box>
      )}
      
      {overallStatus === 'error' && (
        <Box marginTop={2}>
          <Text color="red">❌ Collaboration failed. Please try again.</Text>
        </Box>
      )}
      
      <Box marginTop={2}>
        <Text dimColor>
          {overallStatus === 'running' 
            ? 'Agents are collaborating on your query...'
            : 'Press ESC to return to menu'}
        </Text>
      </Box>
    </Box>
  );
};