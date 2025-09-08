/**
 * Streaming Console Output - Real-time Character Display
 * 
 * Displays Claude responses character-by-character as they stream in,
 * providing immediate visual feedback during agent execution.
 */

import { EventEmitter } from 'events';

export interface StreamingMessage {
  type: 'assistant' | 'system' | 'tool_use' | 'result' | 'user';
  agent?: string;
  content?: string;
  tool?: string;
  timestamp: number;
}

export interface OutputSection {
  agent: string;
  content: string;
  startTime: number;
  isActive: boolean;
}

export class StreamingConsoleOutput extends EventEmitter {
  private sections: Map<string, OutputSection> = new Map();
  private currentAgent?: string;
  private isStreaming = false;
  private streamBuffer = '';
  private lastOutputTime = Date.now();

  /**
   * Start streaming output for an agent
   */
  startAgentStream(agentName: string): void {
    this.currentAgent = agentName;
    this.isStreaming = true;
    
    // Create or update section for this agent
    if (!this.sections.has(agentName)) {
      this.sections.set(agentName, {
        agent: agentName,
        content: '',
        startTime: Date.now(),
        isActive: true
      });
    }
    
    // Show agent header
    console.log(`\n🤖 @${agentName}: Starting analysis...`);
    console.log('─'.repeat(60));
  }

  /**
   * Stream message content character by character
   */
  streamMessage(message: StreamingMessage): void {
    if (!this.isStreaming || !this.currentAgent) {
      return;
    }

    const section = this.sections.get(this.currentAgent);
    if (!section) return;

    // Handle different message types
    switch (message.type) {
      case 'assistant':
        this.streamAssistantMessage(message);
        break;
      
      case 'tool_use':
        this.streamToolUse(message);
        break;
        
      case 'system':
        this.streamSystemMessage(message);
        break;
        
      case 'result':
        this.streamResultMessage(message);
        break;
    }
  }

  /**
   * Stream assistant messages character by character
   */
  private streamAssistantMessage(message: StreamingMessage): void {
    if (!message.content) return;

    // For Claude's text content, stream character by character
    const content = this.extractTextContent(message.content);
    
    if (content) {
      this.streamText(content);
    }
  }

  /**
   * Handle tool use messages
   */
  private streamToolUse(message: StreamingMessage): void {
    const toolName = message.tool || 'tool';
    const statusText = `\n🔧 Using ${toolName}...`;
    
    this.writeImmediate(statusText);
    this.updateSection(statusText);
  }

  /**
   * Handle system messages
   */
  private streamSystemMessage(message: StreamingMessage): void {
    if (message.content) {
      const statusText = `\n💭 System: ${message.content}`;
      this.writeImmediate(statusText);
      this.updateSection(statusText);
    }
  }

  /**
   * Handle result messages
   */
  private streamResultMessage(message: StreamingMessage): void {
    this.finishAgentStream();
  }

  /**
   * Stream text content character by character
   */
  private streamText(text: string): void {
    // Add to buffer and process
    this.streamBuffer += text;
    
    // Stream character by character with small delay for readability
    this.processStreamBuffer();
  }

  /**
   * Process the stream buffer character by character
   */
  private processStreamBuffer(): void {
    if (this.streamBuffer.length === 0) return;

    // Take one character from buffer
    const char = this.streamBuffer.charAt(0);
    this.streamBuffer = this.streamBuffer.slice(1);
    
    // Write immediately without buffering
    process.stdout.write(char);
    
    // Update section content
    this.updateSection(char);
    
    // Continue with next character if more exist
    if (this.streamBuffer.length > 0) {
      // Small delay to make streaming visible (adjust for readability)
      setTimeout(() => this.processStreamBuffer(), 5);
    }
  }

  /**
   * Write text immediately without buffering
   */
  private writeImmediate(text: string): void {
    process.stdout.write(text);
    this.updateSection(text);
  }

  /**
   * Update section content
   */
  private updateSection(content: string): void {
    if (!this.currentAgent) return;
    
    const section = this.sections.get(this.currentAgent);
    if (section) {
      section.content += content;
      this.lastOutputTime = Date.now();
    }
  }

  /**
   * Finish streaming for current agent
   */
  finishAgentStream(): void {
    if (!this.currentAgent) return;
    
    const section = this.sections.get(this.currentAgent);
    if (section) {
      section.isActive = false;
      
      // Add completion indicator
      const duration = Date.now() - section.startTime;
      const completionText = `\n\n✅ @${this.currentAgent} completed in ${Math.round(duration / 1000)}s\n`;
      this.writeImmediate(completionText);
    }
    
    this.isStreaming = false;
    this.currentAgent = undefined;
    this.streamBuffer = '';
  }

  /**
   * Extract text content from Claude message
   */
  private extractTextContent(content: any): string {
    if (typeof content === 'string') {
      return content;
    }
    
    if (Array.isArray(content)) {
      return content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('');
    }
    
    if (content && content.type === 'text' && content.text) {
      return content.text;
    }
    
    return '';
  }

  /**
   * Show analysis stage updates
   */
  showAnalysis(message: string, stage?: string): void {
    const stageIcon = stage === 'routing' ? '🎯' : '🔍';
    console.log(`${stageIcon} ${message}`);
  }

  /**
   * Show agent routing decision
   */
  showRouting(agent: string, confidence: number, reasoning?: string): void {
    console.log(`\n🎯 Routing to @${agent} (${confidence}% confidence)`);
    if (reasoning) {
      console.log(`💭 Reasoning: ${reasoning.slice(0, 120)}...`);
    }
  }

  /**
   * Get current output state
   */
  getOutputState(): {
    currentAgent?: string;
    isStreaming: boolean;
    sections: OutputSection[];
    totalCharacters: number;
  } {
    const sections = Array.from(this.sections.values());
    const totalCharacters = sections.reduce((sum, section) => sum + section.content.length, 0);
    
    return {
      currentAgent: this.currentAgent,
      isStreaming: this.isStreaming,
      sections,
      totalCharacters
    };
  }

  /**
   * Clear all output and reset
   */
  clear(): void {
    console.clear();
    this.sections.clear();
    this.currentAgent = undefined;
    this.isStreaming = false;
    this.streamBuffer = '';
  }

  /**
   * Show real-time status indicators
   */
  showStatus(agent: string, status: 'thinking' | 'writing' | 'reading' | 'complete', details?: string): void {
    const icons = {
      thinking: '💭',
      writing: '✍️',
      reading: '📖',
      complete: '✅'
    };
    
    const statusText = `${icons[status]} @${agent}: ${status}${details ? ` (${details})` : ''}`;
    
    // Use stderr to avoid interfering with main output
    process.stderr.write(`\r${statusText.padEnd(80)}`);
    
    if (status === 'complete') {
      process.stderr.write('\n');
    }
  }
}