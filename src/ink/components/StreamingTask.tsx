import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { StreamingClient, StreamEvent } from '../../streaming/client.js';
import { Loading } from './Loading.js';
import chalk from 'chalk';

interface StreamingTaskProps {
  threadId: string;
  message: string;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

interface TaskOutput {
  id: string;
  content: string;
  type: 'chunk' | 'complete' | 'error';
  timestamp: Date;
}

export const StreamingTask: React.FC<StreamingTaskProps> = ({
  threadId,
  message,
  onComplete,
  onError
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [output, setOutput] = useState<TaskOutput[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [awaitingFeedback, setAwaitingFeedback] = useState(false);
  const [feedbackPrompt, setFeedbackPrompt] = useState('');
  const [userInput, setUserInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { exit } = useApp();
  
  const streamingClientRef = useRef<StreamingClient | null>(null);
  const inputModeRef = useRef(false);

  // Initialize streaming client
  useEffect(() => {
    streamingClientRef.current = new StreamingClient();
    return () => {
      streamingClientRef.current?.disconnect();
    };
  }, []);

  // Start streaming when component mounts
  useEffect(() => {
    const startStreaming = async () => {
      if (!streamingClientRef.current) return;

      try {
        setIsStreaming(true);
        setError(null);

        await streamingClientRef.current.streamMessage(threadId, message, {
          onConnect: () => {
            setIsConnected(true);
            addOutput('Connected to task stream...', 'chunk');
          },
          onDisconnect: () => {
            setIsConnected(false);
            setIsStreaming(false);
            onComplete?.();
          },
          onMessage: (event: StreamEvent) => {
            handleStreamEvent(event);
          },
          onError: (err: Error) => {
            setError(err.message);
            setIsStreaming(false);
            onError?.(err);
          }
        });
      } catch (err) {
        setError((err as Error).message);
        setIsStreaming(false);
        onError?.(err as Error);
      }
    };

    startStreaming();
  }, [threadId, message]);

  const addOutput = (content: string, type: TaskOutput['type']) => {
    setOutput(prev => [...prev, {
      id: Date.now().toString(),
      content,
      type,
      timestamp: new Date()
    }]);
  };

  const handleStreamEvent = (event: StreamEvent) => {
    switch (event.type) {
      case 'chunk':
        if (event.data?.content) {
          setCurrentMessage(prev => prev + event.data.content);
        }
        break;
      
      case 'complete':
        if (currentMessage) {
          addOutput(currentMessage, 'complete');
          setCurrentMessage('');
        }
        if (event.data?.metadata?.final) {
          setIsStreaming(false);
          onComplete?.();
        }
        break;
      
      case 'feedback_request':
        setAwaitingFeedback(true);
        setFeedbackPrompt(event.data?.prompt || 'Feedback requested');
        inputModeRef.current = true;
        break;
      
      case 'error':
        addOutput(`Error: ${event.data?.error || 'Unknown error'}`, 'error');
        setError(event.data?.error || 'Stream error');
        setIsStreaming(false);
        break;
    }
  };

  const handleFeedbackInput = async () => {
    if (!userInput.trim() || !streamingClientRef.current) return;

    try {
      // Send feedback response back to the server
      const response = { text: userInput };
      await streamingClientRef.current.sendFeedback(threadId, 'feedback', response);
      
      addOutput(`> ${userInput}`, 'chunk');
      setUserInput('');
      setAwaitingFeedback(false);
      inputModeRef.current = false;
    } catch (err) {
      setError(`Failed to send feedback: ${(err as Error).message}`);
    }
  };

  // Handle keyboard input
  useInput((input, key) => {
    if (awaitingFeedback) {
      if (key.return) {
        handleFeedbackInput();
      } else if (key.backspace || key.delete) {
        setUserInput(prev => prev.slice(0, -1));
      } else if (key.escape) {
        setAwaitingFeedback(false);
        inputModeRef.current = false;
        setUserInput('');
      } else if (input && !key.ctrl && !key.meta) {
        setUserInput(prev => prev + input);
      }
    } else {
      // Global shortcuts
      if (key.escape || (key.ctrl && input === 'c')) {
        streamingClientRef.current?.disconnect();
        exit();
      }
    }
  });

  const renderOutput = () => {
    const lines: React.ReactNode[] = [];
    
    // Show all completed output
    output.forEach((item, index) => {
      const color = item.type === 'error' ? 'red' : 
                   item.type === 'complete' ? 'green' : 'white';
      lines.push(
        <Text key={item.id} color={color}>
          {item.content}
        </Text>
      );
    });

    // Show current streaming message
    if (currentMessage && isStreaming) {
      lines.push(
        <Box key="current" flexDirection="row">
          <Text color="yellow">{currentMessage}</Text>
          <Text color="gray">|</Text>
        </Box>
      );
    }

    return lines;
  };

  return (
    <Box flexDirection="column" width="100%" height="100%">
      {/* Header */}
      <Box borderStyle="round" borderColor="blue" padding={1} marginBottom={1}>
        <Box flexDirection="column">
          <Text color="blue" bold>
            🚀 Task Execution
          </Text>
          <Text color="gray" dimColor>
            Thread: {threadId.substring(0, 8)}...
          </Text>
          <Text color="gray" dimColor>
            Status: {isConnected ? (isStreaming ? 'Streaming...' : 'Connected') : 'Disconnected'}
          </Text>
        </Box>
      </Box>

      {/* Main output area */}
      <Box flexDirection="column" flexGrow={1} padding={1}>
        {error ? (
          <Box borderStyle="round" borderColor="red" padding={1}>
            <Text color="red">❌ Error: {error}</Text>
          </Box>
        ) : (
          <Box flexDirection="column">
            {renderOutput()}
          </Box>
        )}
      </Box>

      {/* Feedback input */}
      {awaitingFeedback && (
        <Box borderStyle="round" borderColor="yellow" padding={1} marginTop={1}>
          <Box flexDirection="column">
            <Text color="yellow" bold>
              💭 Feedback Required
            </Text>
            <Text>{feedbackPrompt}</Text>
            <Box marginTop={1}>
              <Text color="green">{'> '}</Text>
              <Text>{userInput}</Text>
              <Text color="gray">|</Text>
            </Box>
            <Text color="gray" dimColor>
              Press Enter to submit, Esc to cancel
            </Text>
          </Box>
        </Box>
      )}

      {/* Footer with shortcuts */}
      <Box borderStyle="round" borderColor="gray" padding={1}>
        <Box justifyContent="space-between">
          <Text color="gray" dimColor>
            {isStreaming ? (
              <>⏱️  Task running...</>
            ) : (
              <>✅ Task {error ? 'failed' : 'completed'}</>
            )}
          </Text>
          <Text color="gray" dimColor>
            ESC: Exit | Ctrl+C: Force quit
          </Text>
        </Box>
      </Box>
    </Box>
  );
};