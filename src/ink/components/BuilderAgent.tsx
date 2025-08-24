import React, { useEffect, useState, useRef } from 'react';
import { Box, Text, useApp } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { useAPI, useAuth } from '../hooks/useAPI.js';
import { useStore } from '../store.js';
import EventSource from 'eventsource';
import { getAccentColor, getDimColor, getErrorColor, getSuccessColor } from '../theme/colors.js';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export const BuilderAgent: React.FC = () => {
  const { exit } = useApp();
  const api = useAPI();
  const { isAuthenticated } = useAuth();
  const { setMode } = useStore();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // COMMENTED OUT FOR TESTING - Skip authentication check
  // Check authentication and redirect if needed
  useEffect(() => {
    // if (!isAuthenticated) {
    //   setMode('builder-auth');
    // } else {
    //   initializeBuilderSession();
    // }
    
    // For testing: always initialize builder session
    initializeBuilderSession();
  }, []); // Removed isAuthenticated dependency

  const initializeBuilderSession = async () => {
    try {
      setLoading(true);
      setError(null);

      // COMMENTED OUT FOR TESTING - Skip API call
      // Create a new builder thread
      // const thread = await api.threads.create('Builder Agent Session', 'builder');
      // setThreadId(thread.id);
      
      // For testing: use a mock thread ID
      setThreadId('test-thread-id');

      // Add initial system message
      setMessages([{
        id: 'system-1',
        role: 'system',
        content: 'Welcome to Graphyn Builder! I\'ll help you create custom AI agents for your development workflow. What kind of agent would you like to create?',
        timestamp: new Date()
      }]);

      // Connect to thread stream
      if (threadId) {
        connectToStream(threadId);
      }
      
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize builder session');
      setLoading(false);
    }
  };

  const connectToStream = (threadId: string) => {
    try {
      const eventSource = api.threads.stream(threadId);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setConnected(true);
        setError(null);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle different message types
          if (data.type === 'message' && data.role === 'assistant') {
            setMessages(prev => [...prev, {
              id: data.id || `msg-${Date.now()}`,
              role: 'assistant',
              content: data.content,
              timestamp: new Date(data.timestamp || Date.now())
            }]);
          }
        } catch (err) {
          console.error('Failed to parse SSE message:', err);
        }
      };

      eventSource.onerror = (err) => {
        setConnected(false);
        setError('Connection to builder agent lost. Press R to retry.');
        eventSource.close();
      };
    } catch (err) {
      setError('Failed to connect to builder agent');
      setConnected(false);
    }
  };

  const sendMessage = async (message: string) => {
    if (!threadId || !message.trim()) return;

    // Add user message to UI immediately
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Send message to thread
      await api.post(`/api/threads/${threadId}/messages`, {
        content: message,
        role: 'user'
      });
      
      setLoading(false);
    } catch (err) {
      setError('Failed to send message');
      setLoading(false);
    }
  };

  const handleInputSubmit = (value: string) => {
    sendMessage(value);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (ch: string, key: any) => {
      if (key.escape) {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
        exit();
      }
      if (ch === 'r' && error) {
        if (threadId) {
          connectToStream(threadId);
        }
      }
    };

    process.stdin.on('keypress', handleKeyPress);
    return () => {
      process.stdin.off('keypress', handleKeyPress);
    };
  }, [exit, error, threadId]);

  if (loading && messages.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box>
          <Spinner type="dots" />
          <Text> Initializing Graphyn Builder...</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text bold color="cyan">🤖 Graphyn Builder Agent</Text>
        {connected && <Text color="green"> • Connected</Text>}
        {!connected && <Text color="yellow"> • Connecting...</Text>}
      </Box>

      {/* Messages */}
      <Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={1}>
        {messages.map((msg, index) => (
          <Box key={msg.id} marginBottom={1}>
            {msg.role === 'user' && (
              <Box>
                <Text color="blue">You: </Text>
                <Text>{msg.content}</Text>
              </Box>
            )}
            {msg.role === 'assistant' && (
              <Box>
                <Text color="magenta">Builder: </Text>
                <Text>{msg.content}</Text>
              </Box>
            )}
            {msg.role === 'system' && (
              <Box>
                <Text color="yellow">{msg.content}</Text>
              </Box>
            )}
          </Box>
        ))}
        {loading && (
          <Box>
            <Spinner type="dots" />
            <Text color={getDimColor()}> Builder is thinking...</Text>
          </Box>
        )}
      </Box>

      {/* Error display */}
      {error && (
        <Box paddingX={1}>
          <Text color="red">❌ {error}</Text>
        </Box>
      )}

      {/* Input */}
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color={getAccentColor()}>› </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleInputSubmit}
          placeholder="Describe the agent you want to create..."
        />
      </Box>

      {/* Help text */}
      <Box paddingX={1}>
        <Text color={getDimColor()}>Press ESC to exit, Enter to send message</Text>
      </Box>
    </Box>
  );
};