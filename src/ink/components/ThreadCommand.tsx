import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { GraphynAPIClient } from '../../api-client.js';
import { ConfigManager } from '../../config-manager.js';
import { config } from '../../config.js';
import { colors } from '../../ui.js';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ThreadCommandProps {
  threadId?: string;
}

export const ThreadCommand: React.FC<ThreadCommandProps> = ({ threadId }) => {
  const { exit } = useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(threadId || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');

  useInput((input, key) => {
    if (key.escape) {
      exit();
    }
  });

  useEffect(() => {
    initializeThread();
  }, []);

  const initializeThread = async () => {
    try {
      const configManager = new ConfigManager();
      const token = await configManager.getAuthToken();
      
      if (!token) {
        throw new Error('Not authenticated. Run "graphyn init" first.');
      }

      const apiClient = new GraphynAPIClient();
      apiClient.setToken(token);

      if (threadId) {
        // Load existing thread
        const response = await apiClient.get<{ thread: any; messages: Message[] }>(
          `/threads/${threadId}`
        );
        setMessages(response.messages);
        setCurrentThreadId(threadId);
      } else {
        // Create new thread
        const response = await apiClient.post<{ thread: { id: string } }>(
          '/threads',
          { type: 'builder' }
        );
        setCurrentThreadId(response.thread.id);
        
        // Add welcome message
        setMessages([{
          id: '1',
          role: 'assistant',
          content: "👋 Welcome to the Graphyn Agent Builder!\n\nI'll help you create your AI agent through conversation. What kind of agent would you like to build?",
          timestamp: new Date().toISOString()
        }]);
      }
      
      setLoading(false);
    } catch (error: any) {
      setError(error.message);
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);
    setStreamingMessage('');

    try {
      const configManager = new ConfigManager();
      const token = await configManager.getAuthToken();
      const apiClient = new GraphynAPIClient();
      apiClient.setToken(token!);

      // Send message and handle SSE streaming
      const response = await fetch(`${config.apiBaseUrl}/threads/${currentThreadId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: input })
      });

      if (!response.ok) throw new Error('Failed to send message');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullMessage = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              setIsStreaming(false);
              setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: fullMessage,
                timestamp: new Date().toISOString()
              }]);
              setStreamingMessage('');
            } else {
              try {
                const parsed = JSON.parse(data);
                fullMessage += parsed.content || '';
                setStreamingMessage(fullMessage);
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      }
    } catch (error: any) {
      setError(error.message);
      setIsStreaming(false);
    }
  };

  if (loading) {
    return (
      <Box>
        <Spinner type="dots" />
        <Text> Initializing thread...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">❌ {error}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width="100%">
      <Box borderStyle="round" borderColor="cyan" padding={1} marginBottom={1}>
        <Text bold>🤖 Graphyn Agent Builder - Thread {currentThreadId?.slice(0, 8)}</Text>
      </Box>

      <Box flexDirection="column" height={20} marginBottom={1}>
        {messages.map((msg, index) => (
          <Box key={msg.id} marginBottom={1}>
            <Text bold color={msg.role === 'user' ? 'green' : 'cyan'}>
              {msg.role === 'user' ? 'You: ' : 'Builder: '}
            </Text>
            <Text>{msg.content}</Text>
          </Box>
        ))}
        
        {isStreaming && streamingMessage && (
          <Box>
            <Text bold color="cyan">Builder: </Text>
            <Text>{streamingMessage}</Text>
            <Text color="gray"> ▊</Text>
          </Box>
        )}
      </Box>

      <Box>
        <Text bold>{'> '}</Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={sendMessage}
          placeholder="Type your message..."
        />
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Press ESC to exit • Enter to send</Text>
      </Box>
    </Box>
  );
};