import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import EventSource from 'eventsource';
import { pollThreadMessages } from '../utils/thread-api.js';

interface Agent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  systemPrompt: string;
  capabilities: string[];
  metadata?: Record<string, any>;
}

interface InteractiveSquadBuilderProps {
  threadId: string;
  token: string;
  apiUrl: string;
  onSquadApproved?: (agents: Agent[]) => void;
  onExit?: () => void;
}

type ViewMode = 'loading' | 'list' | 'detail' | 'input' | 'agent-refine';

export const InteractiveSquadBuilder: React.FC<InteractiveSquadBuilderProps> = ({
  threadId,
  token,
  apiUrl,
  onSquadApproved,
  onExit
}) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('loading');
  const [userInput, setUserInput] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamContent, setCurrentStreamContent] = useState('');
  const streamContentRef = React.useRef('');
  const [refineMode, setRefineMode] = useState<'squad' | 'agent'>('squad');
  const [selectedAgentForRefine, setSelectedAgentForRefine] = useState<Agent | null>(null);
  const [lastKeyPress, setLastKeyPress] = useState<string>('');

  // Connect to SSE stream
  useEffect(() => {
    console.log('Connecting to SSE stream:', `${apiUrl}/api/threads/${threadId}/stream`);
    console.log('Using token:', token.substring(0, 20) + '...');
    
    let eventSource: EventSource | null = null;
    let stopPollingFn: (() => void) | null = null;
    
    // Use the EventSource polyfill that supports headers
    eventSource = new EventSource(
      `${apiUrl}/api/threads/${threadId}/stream`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      } as any
    );

    eventSource.onopen = () => {
      console.log('SSE connection opened successfully');
      setMessages(prev => [...prev, 'Connected to Team Builder...']);
    };

    eventSource.onmessage = (event) => {
      try {
        console.log('SSE event received:', event.data);
        const data = JSON.parse(event.data);
        
        if (data.type === 'message.chunk') {
          setIsStreaming(true);
          // Use ref to accumulate content properly
          streamContentRef.current += data.content || '';
          setCurrentStreamContent(streamContentRef.current);
          
          // Check for squad recommendation in streaming content
          if (streamContentRef.current.includes('[SQUAD_RECOMMENDATION]') && streamContentRef.current.includes('[/SQUAD_RECOMMENDATION]')) {
            console.log('Found complete squad recommendation in chunk');
            parseSquadRecommendation(streamContentRef.current);
          }
        } else if (data.type === 'message.complete') {
          setIsStreaming(false);
          const fullMessage = streamContentRef.current;
          console.log('Message complete, full content:', fullMessage);
          setMessages(prev => [...prev, fullMessage]);
          
          // Parse for squad recommendations in complete message
          if (fullMessage.includes('[SQUAD_RECOMMENDATION]')) {
            console.log('Parsing squad recommendation from complete message');
            parseSquadRecommendation(fullMessage);
          }
          
          // Reset after processing
          setCurrentStreamContent('');
          streamContentRef.current = '';
        } else if (data.type === 'squad.recommendation') {
          // Direct squad recommendation event
          console.log('Direct squad recommendation event:', data);
          setAgents(data.agents);
          setViewMode('list');
        } else {
          console.log('Other event type:', data.type);
        }
      } catch (err) {
        console.error('Error parsing SSE event:', err);
        console.error('Raw event data:', event.data);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      console.log('Falling back to polling...');
      if (eventSource) {
        eventSource.close();
      }
      
      // Fallback to polling
      stopPollingFn = pollThreadMessages(
        threadId,
        token,
        apiUrl,
        (message) => {
          console.log('New message from polling:', message);
          if (message.sender_type === 'agent' && message.content) {
            streamContentRef.current = message.content;
            setCurrentStreamContent(message.content);
            setMessages(prev => [...prev, message.content]);
            
            if (message.content.includes('[SQUAD_RECOMMENDATION]')) {
              parseSquadRecommendation(message.content);
            }
          }
        }
      );
    };

    // Also listen for custom events
    eventSource.addEventListener('message', (event: any) => {
      console.log('Custom message event:', event);
    });
    
    // Listen for thread events
    eventSource.addEventListener('thread.message', (event: any) => {
      console.log('Thread message event:', event.data);
      try {
        const data = JSON.parse(event.data);
        if (data.content) {
          streamContentRef.current += data.content;
          setCurrentStreamContent(streamContentRef.current);
          
          if (streamContentRef.current.includes('[SQUAD_RECOMMENDATION]')) {
            parseSquadRecommendation(streamContentRef.current);
          }
        }
      } catch (err) {
        console.error('Error handling thread message:', err);
      }
    });

    // Initial state
    setViewMode('list');
    setMessages(['Analyzing your request...']);
    
    // Start polling immediately as backup
    console.log('Starting message polling as backup...');
    stopPollingFn = pollThreadMessages(
      threadId,
      token,
      apiUrl,
      (message) => {
        console.log('Message from polling:', message);
        if (message.sender_type === 'agent' && message.content) {
          streamContentRef.current = message.content;
          setCurrentStreamContent(message.content);
          
          if (message.content.includes('[SQUAD_RECOMMENDATION]')) {
            console.log('Found squad recommendation in polled message');
            parseSquadRecommendation(message.content);
          }
        }
      },
      1000 // Poll every second
    );

    // Cleanup function
    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (stopPollingFn) {
        stopPollingFn();
      }
    };
  }, [threadId, token, apiUrl]);

  // Keyboard navigation
  useInput((input, key) => {
    if (viewMode === 'list') {
      // Vim navigation
      if (key.upArrow || input === 'k') {
        setSelectedIndex(Math.max(0, selectedIndex - 1));
        setLastKeyPress('');
      } else if (key.downArrow || input === 'j') {
        setSelectedIndex(Math.min(agents.length - 1, selectedIndex + 1));
        setLastKeyPress('');
      } else if (input === 'g') {
        if (lastKeyPress === 'g') {
          // gg - go to top
          setSelectedIndex(0);
          setLastKeyPress('');
        } else {
          setLastKeyPress('g');
        }
      } else if (input === 'G') {
        // G - go to bottom
        setSelectedIndex(Math.max(0, agents.length - 1));
        setLastKeyPress('');
      } else if (key.return || input === 'l') {
        if (agents.length > 0) {
          setViewMode('detail');
        }
      } else if (key.escape || input === 'q') {
        onExit?.();
        setLastKeyPress('');
      } else if (input === 'r' || input === 'R') {
        setRefineMode('squad');
        setViewMode('input');
      } else if (input === 'a' || input === 'A') {
        handleSquadApproval();
        setLastKeyPress('');
      } else if (input !== 'g') {
        // Reset last key if it's not part of a combo
        setLastKeyPress('');
      }
    } else if (viewMode === 'detail') {
      if (key.escape || input === 'h') {
        // h or ESC - go back to list
        setViewMode('list');
        setLastKeyPress('');
      } else if (input === 'i' || input === 'I') {
        // Improve individual agent
        setSelectedAgentForRefine(agents[selectedIndex]);
        setRefineMode('agent');
        setViewMode('agent-refine');
      } else if (input === 'f' || input === 'F') {
        // Legacy feedback option
        setSelectedAgentForRefine(agents[selectedIndex]);
        setRefineMode('agent');
        setViewMode('agent-refine');
      }
    } else if (viewMode === 'input') {
      if (key.escape) {
        setViewMode('list');
        setUserInput('');
        setRefineMode('squad');
        setLastKeyPress('');
      }
    } else if (viewMode === 'agent-refine') {
      if (key.escape) {
        setViewMode('detail');
        setUserInput('');
        setSelectedAgentForRefine(null);
        setRefineMode('squad');
        setLastKeyPress('');
      }
    }
  });

  const parseSquadRecommendation = (content: string) => {
    // Parse squad recommendation from Team Builder response
    try {
      const match = content.match(/\[SQUAD_RECOMMENDATION\]([\s\S]*?)\[\/SQUAD_RECOMMENDATION\]/);
      if (match) {
        // Clean up the JSON string - remove any extra whitespace or newlines
        const jsonStr = match[1].trim();
        console.log('Parsing squad recommendation:', jsonStr);
        
        const squadData = JSON.parse(jsonStr);
        if (squadData.agents && Array.isArray(squadData.agents)) {
          console.log(`Found ${squadData.agents.length} agents in recommendation`);
          setAgents(squadData.agents);
          setViewMode('list'); // Always return to list view when new recommendation arrives
          setIsStreaming(false); // Stop streaming indicator
          
          // Clear streaming content since we've processed it
          streamContentRef.current = '';
          setCurrentStreamContent('');
        }
      }
    } catch (err) {
      console.error('Error parsing squad recommendation:', err);
      console.error('Content was:', content);
    }
  };

  const sendMessage = async (content: string) => {
    try {
      // Clear input immediately
      setUserInput('');
      
      // Show loading state with the user's message
      setViewMode('loading');
      setMessages(prev => [...prev, `You: ${content}`, 'Team Builder is refining squad configuration...']);
      setIsStreaming(true);
      
      // Clear previous content
      streamContentRef.current = '';
      setCurrentStreamContent('');
      
      // Send the message
      const response = await fetch(`${apiUrl}/api/threads/${threadId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }
      
      // After sending, we'll wait for the response via SSE/polling
      // The loading view will show while we wait
      
      // Reset refine mode after sending
      setTimeout(() => {
        setRefineMode('squad');
        setSelectedAgentForRefine(null);
      }, 100);
    } catch (err) {
      console.error('Error sending message:', err);
      setViewMode('list');
      setIsStreaming(false);
      setRefineMode('squad');
      setSelectedAgentForRefine(null);
    }
  };

  const handleSquadApproval = () => {
    if (agents.length > 0) {
      onSquadApproved?.(agents);
    }
  };

  const renderLoading = () => (
    <Box flexDirection="column">
      <Text color="cyan" bold>
        <Spinner type="dots" />{' '}
        {messages.length > 0 && messages[messages.length - 1].startsWith('You:') 
          ? 'Squad is refining, please wait...' 
          : 'Team Builder is analyzing...'}
      </Text>
      {messages.map((msg, idx) => (
        <Text key={idx} dimColor>{msg}</Text>
      ))}
      {isStreaming && currentStreamContent && (
        <Box marginTop={1}>
          <Text>{currentStreamContent}</Text>
        </Box>
      )}
    </Box>
  );

  const renderListView = () => (
    <Box flexDirection="column">
      <Text color="cyan" bold>🎯 Recommended Squad Configuration:</Text>
      <Box marginTop={1} flexDirection="column">
        {agents.length === 0 ? (
          <Box flexDirection="column">
            <Text dimColor>Waiting for Team Builder recommendations...</Text>
            {currentStreamContent && (
              <Box marginTop={1} borderStyle="single" padding={1}>
                <Text wrap="wrap">Debug: {currentStreamContent.substring(0, 300)}...</Text>
              </Box>
            )}
            {messages.length > 0 && (
              <Box marginTop={1}>
                <Text dimColor>Last message: {messages[messages.length - 1]?.substring(0, 100)}...</Text>
              </Box>
            )}
          </Box>
        ) : (
          agents.map((agent, idx) => (
            <Box key={agent.id} marginLeft={1}>
              <Text
                color={idx === selectedIndex ? 'cyan' : 'white'}
                bold={idx === selectedIndex}
              >
                {idx === selectedIndex ? '▶' : ' '} {agent.emoji || '🤖'} {agent.name}
              </Text>
              <Box marginLeft={3}>
                <Text dimColor>{agent.role}</Text>
              </Box>
            </Box>
          ))
        )}
      </Box>
      
      <Box marginTop={2} flexDirection="column">
        <Text dimColor>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text>
        <Text dimColor>↑↓/jk Navigate • ↵/l View • gg/G Top/Bottom</Text>
        <Text dimColor>R Refine • A Approve • ESC/q Exit</Text>
      </Box>
    </Box>
  );

  const renderDetailView = () => {
    const agent = agents[selectedIndex];
    if (!agent) return null;

    return (
      <Box flexDirection="column">
        <Text color="cyan" bold>{agent.emoji} {agent.name} - Detailed Configuration</Text>
        
        <Box marginTop={1} borderStyle="single" padding={1} flexDirection="column">
          <Text bold>Role:</Text>
          <Text>{agent.role}</Text>
          
          <Box marginTop={1}>
            <Text bold>System Prompt:</Text>
            <Text wrap="wrap">{agent.systemPrompt}</Text>
          </Box>
          
          {agent.capabilities && agent.capabilities.length > 0 && (
            <Box marginTop={1} flexDirection="column">
              <Text bold>Capabilities:</Text>
              {agent.capabilities.map((cap, idx) => (
                <Text key={idx}>• {cap}</Text>
              ))}
            </Box>
          )}
        </Box>
        
        <Box marginTop={1}>
          <Text dimColor>I Improve Agent • ESC/h Back to List</Text>
        </Box>
      </Box>
    );
  };

  const renderInputView = () => {
    const isAgentRefine = viewMode === 'agent-refine';
    
    return (
      <Box flexDirection="column">
        {isAgentRefine && (
          <Box marginBottom={1}>
            <Text dimColor>Squad {'>'} {selectedAgentForRefine?.name} {'>'} Improve</Text>
          </Box>
        )}
        <Text color="cyan" bold>
          {isAgentRefine && selectedAgentForRefine
            ? `💡 Improving ${selectedAgentForRefine.emoji} ${selectedAgentForRefine.name}:`
            : '💬 Refine squad configuration:'}
        </Text>
      
      <Box marginTop={1}>
        <Text>{'> '}</Text>
        <TextInput
          value={userInput}
          onChange={setUserInput}
          onSubmit={sendMessage}
          placeholder={isAgentRefine 
            ? `How should ${selectedAgentForRefine?.name} be improved?`
            : "Type your refinement request..."}
        />
      </Box>
      
      <Box marginTop={1}>
        <Text dimColor>ESC Cancel</Text>
      </Box>
    </Box>
    );
  };

  // Recent messages display
  const recentMessages = messages.slice(-3);

  return (
    <Box flexDirection="column" padding={1}>
      {/* Message history */}
      {recentMessages.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          {recentMessages.map((msg, idx) => (
            <Text key={idx} dimColor>{msg}</Text>
          ))}
        </Box>
      )}

      {/* Main view */}
      {viewMode === 'loading' && renderLoading()}
      {viewMode === 'list' && renderListView()}
      {viewMode === 'detail' && renderDetailView()}
      {viewMode === 'input' && renderInputView()}
      {viewMode === 'agent-refine' && renderInputView()}
    </Box>
  );
};