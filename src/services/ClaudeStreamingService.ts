/**
 * Claude Streaming Service - Unified streaming interface for all Claude interactions
 * 
 * This is the SINGLE place where ALL Claude Code SDK interactions happen.
 * Everything streams in real-time, nothing waits for full responses.
 */

import { query } from '@anthropic-ai/claude-code';

export interface StreamingResponse {
  content: string;
  isComplete: boolean;
  metadata?: {
    type: string;
    confidence?: number;
    classification?: string;
  };
}

export interface StreamingOptions {
  workingDirectory?: string;
  maxTurns?: number;
  allowedTools?: string[];
  timeout?: number;
}

export class ClaudeStreamingService {
  
  /**
   * Stream a conversation with Claude - THIS IS THE ONLY METHOD YOU SHOULD USE
   * 
   * @param messages - AsyncGenerator that yields messages over time
   * @param options - Streaming configuration
   * @param onChunk - Called for each streaming chunk as it arrives
   * @param onComplete - Called when the response is complete
   */
  async streamConversation(
    messages: AsyncGenerator<any, void, unknown>,
    options: StreamingOptions = {},
    onChunk: (chunk: string) => void,
    onComplete: (fullResponse: string, metadata?: any) => void
  ): Promise<void> {
    
    let fullResponse = '';
    let isStreaming = false;
    
    try {
      for await (const message of query({
        prompt: messages,
        options: {
          cwd: options.workingDirectory || process.cwd(),
          maxTurns: options.maxTurns || 5,
          allowedTools: options.allowedTools || []
        }
      })) {
        
        // Handle streaming assistant responses
        if (message.type === 'assistant') {
          isStreaming = true;
          const content = message.message.content
            .map((block: any) => block.type === 'text' ? block.text : '')
            .join('');
          
          if (content) {
            // Stream each chunk immediately as it arrives
            onChunk(content);
            fullResponse += content;
          }
        }
        
        // Handle final result
        else if (message.type === 'result') {
          if (message.subtype === 'success') {
            // If no streaming occurred, use the final result
            if (!isStreaming && message.result) {
              fullResponse = message.result;
              onChunk(fullResponse);
            }
            
            onComplete(fullResponse);
            return;
          } else {
            throw new Error(`Claude streaming failed: ${message.subtype}`);
          }
        }
        
        // Handle system messages for debugging
        else if (message.type === 'system') {
          // Silent - no logging needed
        }
      }
      
      throw new Error('Claude streaming ended without result');
      
    } catch (error) {
      throw new Error(`Claude streaming failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Stream a simple query with immediate response
   */
  async streamQuery(
    userMessage: string, 
    options: StreamingOptions = {},
    onChunk: (chunk: string) => void,
    onComplete: (fullResponse: string) => void
  ): Promise<void> {
    
    // Create a simple message generator
    async function* generateMessage() {
      yield {
        type: "user" as const,
        message: {
          role: "user" as const,
          content: userMessage
        },
        parent_tool_use_id: null,
        session_id: `session-${Date.now()}`
      };
    }
    
    await this.streamConversation(
      generateMessage(),
      options,
      onChunk,
      onComplete
    );
  }
  
  /**
   * Stream a conversational greeting/response
   */
  async streamGreeting(
    userQuery: string,
    options: StreamingOptions = {},
    onChunk: (chunk: string) => void,
    onComplete: (fullResponse: string) => void
  ): Promise<void> {
    
    const greetingPrompt = `The user said: "${userQuery}"

Please respond naturally to the user. If it's:
- A greeting: Respond warmly and offer help
- A question: Answer it helpfully  
- A task request: Acknowledge and explain what you can help with
- General conversation: Engage naturally

Respond directly to the user in a helpful, conversational way.`;

    await this.streamQuery(greetingPrompt, options, onChunk, onComplete);
  }
  
  /**
   * Stream a multi-turn conversation
   */
  async streamMultiTurn(
    initialMessage: string,
    followUpGenerator: () => AsyncGenerator<string, void, unknown>,
    options: StreamingOptions = {},
    onChunk: (chunk: string) => void,
    onComplete: (fullResponse: string) => void
  ): Promise<void> {
    
    // Create multi-turn message generator
    async function* generateMessages() {
      // First message
      yield {
        type: "user" as const,
        message: {
          role: "user" as const,
          content: initialMessage
        },
        parent_tool_use_id: null,
        session_id: `multi-session-${Date.now()}`
      };
      
      // Additional messages from generator
      for await (const followUp of followUpGenerator()) {
        // Small delay to simulate real conversation timing
        await new Promise(resolve => setTimeout(resolve, 100));
        
        yield {
          type: "user" as const,
          message: {
            role: "user" as const,
            content: followUp
          },
          parent_tool_use_id: null,
          session_id: `multi-session-${Date.now()}`
        };
      }
    }
    
    await this.streamConversation(
      generateMessages(),
      options,
      onChunk,
      onComplete
    );
  }
}

// Export singleton instance
export const claudeStreamingService = new ClaudeStreamingService();
