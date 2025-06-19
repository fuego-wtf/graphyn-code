import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { useStore } from '../store.js';
import { useThreadStream, useAPI } from '../hooks/useAPI.js';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  participantId?: string;
  participantName?: string;
}

interface ThreadStreamProps {
  threadId: string;
  threadName?: string;
}

export const ThreadStream: React.FC<ThreadStreamProps> = ({ threadId, threadName }) => {
  const { exit } = useApp();
  const { reset } = useStore();
  const api = useAPI();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<number>(0);
  
  // Use SSE hook
  const { messages: streamMessages, connected, error: streamError } = useThreadStream(threadId);
  
  // Navigation
  useInput((input, key) => {
    if (key.escape && !inputValue) {
      reset();
    } else if (key.upArrow) {
      // Scroll up in messages
      messagesEndRef.current = Math.max(0, messagesEndRef.current - 1);
    } else if (key.downArrow) {
      // Scroll down in messages
      messagesEndRef.current = Math.min(messages.length - 1, messagesEndRef.current + 1);
    }
  });

  // Load initial messages
  useEffect(() => {
    loadMessages();
  }, [threadId]);

  // Handle streaming messages
  useEffect(() => {
    if (streamMessages.length > 0) {
      const latestMessage = streamMessages[streamMessages.length - 1];
      
      // Check if it's a new message or an update
      setMessages(prev => {
        const existingIndex = prev.findIndex(m => m.id === latestMessage.id);
        if (existingIndex >= 0) {
          // Update existing message
          const updated = [...prev];
          updated[existingIndex] = { ...updated[existingIndex], ...latestMessage };
          return updated;
        } else {
          // Add new message
          return [...prev, latestMessage];
        }
      });
      
      // Auto-scroll to bottom
      messagesEndRef.current = messages.length;
    }
  }, [streamMessages]);

  const loadMessages = async () => {
    try {
      const response = await api.get<{ messages: Message[] }>(`/api/v1/threads/${threadId}/messages`);
      setMessages(response.messages || []);
      messagesEndRef.current = response.messages?.length || 0;
    } catch (err) {
      setError('Failed to load messages');
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || sending) return;
    
    setSending(true);
    setError(null);
    
    try {
      await api.post(`/api/v1/threads/${threadId}/messages`, {
        content: inputValue,
        role: 'user'
      });
      
      setInputValue('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getMessageColor = (role: string) => {
    switch (role) {
      case 'user': return 'cyan';
      case 'assistant': return 'green';
      case 'system': return 'gray';
      default: return 'white';
    }
  };

  // Calculate visible messages (simple pagination)
  const visibleMessages = messages.slice(Math.max(0, messagesEndRef.current - 10), messagesEndRef.current + 1);

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Box justifyContent="space-between" width="100%">
          <Text bold>🗨️  {threadName || `Thread ${threadId}`}</Text>
          <Box>
            {connected ? (
              <Text color="green">● Connected</Text>
            ) : (
              <Text color="yellow">○ Connecting...</Text>
            )}
          </Box>
        </Box>
      </Box>

      {/* Messages */}
      <Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={1}>
        {messages.length === 0 ? (
          <Text color="gray">No messages yet. Start the conversation!</Text>
        ) : (
          <>
            {messagesEndRef.current > 10 && (
              <Text color="gray" dimColor>↑ {messagesEndRef.current - 10} more messages above</Text>
            )}
            
            {visibleMessages.map((message, index) => (
              <Box key={message.id} marginBottom={1} flexDirection="column">
                <Box>
                  <Text color={getMessageColor(message.role)} bold>
                    {message.participantName || message.role}
                  </Text>
                  <Text color="gray"> · {formatTimestamp(message.timestamp)}</Text>
                </Box>
                <Box marginLeft={2}>
                  <Text wrap="wrap">{message.content}</Text>
                </Box>
              </Box>
            ))}
            
            {messagesEndRef.current < messages.length - 1 && (
              <Text color="gray" dimColor>↓ {messages.length - messagesEndRef.current - 1} more messages below</Text>
            )}
          </>
        )}
        
        {/* Streaming indicator */}
        {streamMessages.length > 0 && streamMessages[streamMessages.length - 1].role === 'assistant' && (
          <Box marginTop={1}>
            <Spinner type="dots" />
            <Text color="green"> AI is typing...</Text>
          </Box>
        )}
      </Box>

      {/* Error display */}
      {(error || streamError) && (
        <Box paddingX={1}>
          <Text color="red">❌ {error || streamError}</Text>
        </Box>
      )}

      {/* Input */}
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Box width="100%">
          <Text color="cyan">› </Text>
          <Box flexGrow={1}>
            <TextInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={sendMessage}
              placeholder="Type a message..."
            />
          </Box>
          {sending && (
            <Box marginLeft={1}>
              <Spinner type="dots" />
            </Box>
          )}
        </Box>
      </Box>

      {/* Help */}
      <Box paddingX={1} paddingBottom={1}>
        <Text dimColor>
          ↑↓ Scroll messages • ↵ Send • ESC Exit
        </Text>
      </Box>
    </Box>
  );
};