/**
 * Query Understanding Engine - Intelligent query classification before planning
 * 
 * Prevents silly task creation for greetings and casual queries
 * Uses Claude Code SDK to understand query intent and route appropriately
 */

import { claudeHeadlessStreamingService } from '../services/ClaudeHeadlessStreamingService.js';

export interface QueryUnderstanding {
  queryType: 'greeting' | 'question' | 'task_request' | 'conversational';
  intent: string;
  confidence: number;
  requiresTaskPlanning: boolean;
  suggestedResponse?: string;
  reasoning: string;
}

export class QueryUnderstandingEngine {
  
  /**
   * Analyze and classify a user query using Claude Code SDK
   */
  async understandQuery(query: string, workingDirectory: string): Promise<QueryUnderstanding> {
    const normalizedQuery = query.trim().toLowerCase();
    
    // ALWAYS use Claude Code SDK - no more static responses at all!
    return await this.analyzeWithClaude(query, workingDirectory);
  }
  
  /**
   * Quick pattern-based classification for obvious cases
   */
  private quickClassifyQuery(normalizedQuery: string): QueryUnderstanding {
    // Greetings and casual conversation
    const greetingPatterns = [
      /^(hi|hello|hey|sup|what's up|whats up|yo)( there| you)?[!?]*$/,
      /^(good morning|good afternoon|good evening|good night)[!?]*$/,
      /^(thanks?|thank you|thx)[!?]*$/,
      /^(bye|goodbye|see you|cya|later)[!?]*$/,
      /^(how are you|how's it going|how goes it)[?]*$/,
      /^(nice|cool|awesome|great|ok|okay)[!?]*$/
    ];
    
    for (const pattern of greetingPatterns) {
      if (pattern.test(normalizedQuery)) {
        return {
          queryType: 'greeting',
          intent: 'casual_greeting',
          confidence: 0.95,
          requiresTaskPlanning: false,
          suggestedResponse: this.generateGreetingResponse(normalizedQuery),
          reasoning: 'Detected casual greeting pattern'
        };
      }
    }
    
    // Simple questions
    const questionPatterns = [
      /^(what|how|why|when|where|who|which).*[?]?$/,
      /^(can you|could you|would you).*[?]?$/,
      /^(is|are|do|does|did|will|would|should).*[?]?$/,
      /^(help|explain|tell me|show me)(?!.*create|.*build|.*make|.*implement).*/
    ];
    
    for (const pattern of questionPatterns) {
      if (pattern.test(normalizedQuery)) {
        return {
          queryType: 'question',
          intent: 'information_request',
          confidence: 0.85,
          requiresTaskPlanning: false,
          reasoning: 'Detected question pattern - likely seeking information rather than task execution'
        };
      }
    }
    
    // Clear task requests
    const taskPatterns = [
      /^(create|build|make|implement|add|develop|write|generate|setup|configure)/,
      /^(fix|debug|resolve|repair|solve)/,
      /^(test|verify|validate|check)/,
      /^(deploy|release|publish|ship)/,
      /^(optimize|improve|enhance|refactor)/,
      /^(delete|remove|clean)/,
      /^(install|update|upgrade)/
    ];
    
    for (const pattern of taskPatterns) {
      if (pattern.test(normalizedQuery)) {
        return {
          queryType: 'task_request',
          intent: 'task_execution',
          confidence: 0.9,
          requiresTaskPlanning: true,
          reasoning: 'Detected clear task action verb'
        };
      }
    }
    
    // Default to ambiguous - needs deeper analysis
    return {
      queryType: 'conversational',
      intent: 'ambiguous',
      confidence: 0.3,
      requiresTaskPlanning: false,
      reasoning: 'Query type unclear - requires deeper analysis'
    };
  }
  
  /**
   * Analyze query with centralized Claude streaming service
   */
  private async analyzeWithClaude(userQuery: string, workingDirectory: string): Promise<QueryUnderstanding> {
    try {
      process.stdout.write('🧠 Analyzing... ');
      
      let finalResult = '';
      
      // Use enhanced CLI streaming service for real-time responses
      await claudeHeadlessStreamingService.streamGreeting(
        userQuery,
        {
          workingDirectory,
          verbose: false,
          timeout: 15000,
          allowedTools: []
        },
        // onChunk - streams in real-time
        (chunk: string) => {
          process.stdout.write(chunk);
          finalResult += chunk;
        },
        // onComplete
        (fullResponse: string) => {
          process.stdout.write('✓\n');
        }
      );
      
      // Return the understanding with Claude's streaming response
      return {
        queryType: 'conversational',
        intent: 'natural_response',
        confidence: 0.9,
        requiresTaskPlanning: false,
        suggestedResponse: finalResult,
        reasoning: 'Claude centralized streaming response'
      };
      
    } catch (error) {
      console.error('\nClaude streaming analysis failed:', error instanceof Error ? error.message : String(error));
      console.log('Falling back to pattern matching...');
      
      return this.quickClassifyQuery(userQuery.toLowerCase().trim());
    }
  }

  /**
   * Enhanced heuristic analysis for ambiguous queries (DEPRECATED - replaced with Claude SDK)
   */
  private enhancedHeuristicAnalysis(query: string, workingDirectory: string): QueryUnderstanding {
    const normalizedQuery = query.trim().toLowerCase();
    const queryLength = normalizedQuery.length;
    
    // Check for help/understand requests (questions about understanding)
    const understandingPatterns = [
      /.*understand.*/,
      /.*help.*me.*/,
      /.*explain.*/,
      /.*what.*is.*/,
      /.*how.*does.*/,
      /.*show.*me.*/,
      /.*tell.*me.*/
    ];
    
    for (const pattern of understandingPatterns) {
      if (pattern.test(normalizedQuery)) {
        return {
          queryType: 'question',
          intent: 'understanding_request',
          confidence: 0.85,
          requiresTaskPlanning: false,
          reasoning: 'User is asking for understanding or explanation'
        };
      }
    }
    
    // Check for conversational but development-focused queries
    const devConversationalPatterns = [
      /.*want.to.*/,
      /.*need.to.*/,
      /.*should.i.*/,
      /.*thinking.about.*/,
      /.*considering.*/,
      /.*looking.at.*/,
      /.*working.on.*/
    ];
    
    for (const pattern of devConversationalPatterns) {
      if (pattern.test(normalizedQuery)) {
        // Check if it contains task-like words
        const taskWords = ['build', 'create', 'make', 'implement', 'develop', 'code', 'write'];
        const hasTaskWords = taskWords.some(word => normalizedQuery.includes(word));
        
        if (hasTaskWords) {
          return {
            queryType: 'task_request',
            intent: 'development_task',
            confidence: 0.75,
            requiresTaskPlanning: true,
            reasoning: 'Conversational query with task-oriented intent'
          };
        } else {
          return {
            queryType: 'conversational',
            intent: 'development_discussion',
            confidence: 0.8,
            requiresTaskPlanning: false,
            reasoning: 'Conversational query about development topics'
          };
        }
      }
    }
    
    // No fallback - throw error if query classification fails
    throw new Error('Unable to classify query intent - query patterns too ambiguous');
  }
  
  /**
   * Deep analysis using Claude Code SDK for ambiguous queries (UNUSED - causes hanging)
   */
  private async deepAnalyzeWithClaude(query: string, workingDirectory: string): Promise<QueryUnderstanding> {
    try {
      // Build analysis prompt for Claude
      const analysisPrompt = `Analyze this user query and classify its intent:

Query: "${query}"

Context: User is in a development environment at: ${workingDirectory}

Classify the query as one of:
1. **greeting** - Casual greetings, thanks, small talk (should respond conversationally)
2. **question** - Seeking information or explanation (should answer directly)  
3. **task_request** - Wants me to build, create, fix, or modify something (should plan tasks)
4. **conversational** - General discussion about development (should engage conversationally)

Provide your analysis in this exact JSON format:
{
  "queryType": "greeting|question|task_request|conversational",
  "intent": "brief_description_of_intent",
  "confidence": 0.8,
  "requiresTaskPlanning": true/false,
  "reasoning": "why_you_classified_it_this_way"
}`;

      throw new Error('deepAnalyzeWithClaude is deprecated - use analyzeWithClaude instead');
      
    } catch (error) {
      console.error('Deep query analysis failed:', error);
      throw new Error(`Deep query analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Parse Claude's JSON response
   */
  private parseClaudeAnalysis(claudeResponse: string): QueryUnderstanding | null {
    try {
      // Extract JSON from Claude's response
      const jsonMatch = claudeResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      if (!parsed.queryType || !parsed.intent || typeof parsed.confidence !== 'number') {
        return null;
      }
      
      return {
        queryType: parsed.queryType,
        intent: parsed.intent,
        confidence: Math.min(Math.max(parsed.confidence, 0), 1), // Clamp 0-1
        requiresTaskPlanning: parsed.requiresTaskPlanning || false,
        reasoning: parsed.reasoning || 'Analysis from Claude Code SDK'
      };
      
    } catch (error) {
      console.error('Failed to parse Claude analysis response:', error);
      throw new Error(`Failed to parse Claude analysis: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  /**
   * Parse Claude's natural response and use it directly - NO PATTERN MATCHING!
   */
  private parseNaturalResponse(claudeResponse: string, originalQuery: string): QueryUnderstanding | null {
    try {
      const response = claudeResponse.trim();
      
      // Don't do ANY pattern matching - just assume it's conversational and use Claude's response
      // Let Claude decide what's appropriate through its response!
      return {
        queryType: 'conversational',
        intent: 'natural_response',
        confidence: 0.9,
        requiresTaskPlanning: false, // Don't plan tasks - Claude already responded naturally
        suggestedResponse: response, // USE CLAUDE'S ACTUAL RESPONSE!
        reasoning: 'Using Claude\'s direct natural response without any pattern matching'
      };
      
    } catch (error) {
      console.error('Failed to parse Claude natural response:', error);
      return null;
    }
  }
  
  /**
   * Parse Claude's simple letter response (a, b, c, d)
   */
  private parseSimpleClaudeResponse(claudeResponse: string, originalQuery: string): QueryUnderstanding | null {
    try {
      const response = claudeResponse.trim().toLowerCase();
      
      // Extract the letter (a, b, c, or d) from the response
      let letter = '';
      if (response.includes('a)') || response.includes('a.') || response === 'a') {
        letter = 'a';
      } else if (response.includes('b)') || response.includes('b.') || response === 'b') {
        letter = 'b';
      } else if (response.includes('c)') || response.includes('c.') || response === 'c') {
        letter = 'c';
      } else if (response.includes('d)') || response.includes('d.') || response === 'd') {
        letter = 'd';
      }
      
      // Convert letter to QueryUnderstanding
      switch (letter) {
        case 'a': // greeting
          return {
            queryType: 'greeting',
            intent: 'casual_greeting',
            confidence: 0.8,
            requiresTaskPlanning: false,
            reasoning: 'Classified as greeting by Claude AI'
          };
        
        case 'b': // question
          return {
            queryType: 'question',
            intent: 'information_request',
            confidence: 0.8,
            requiresTaskPlanning: false,
            reasoning: 'Classified as question by Claude AI'
          };
        
        case 'c': // task
          return {
            queryType: 'task_request',
            intent: 'task_execution',
            confidence: 0.8,
            requiresTaskPlanning: true,
            reasoning: 'Classified as task request by Claude AI'
          };
        
        case 'd': // conversation
          return {
            queryType: 'conversational',
            intent: 'general_discussion',
            confidence: 0.8,
            requiresTaskPlanning: false,
            reasoning: 'Classified as conversational by Claude AI'
          };
        
        default:
          return null;
      }
      
    } catch (error) {
      console.error('Failed to parse simple Claude response:', error);
      return null;
    }
  }
  
  /**
   * Generate appropriate greeting response
   */
  private generateGreetingResponse(normalizedQuery: string): string {
    if (normalizedQuery.includes('thank')) {
      return "You're welcome! Happy to help with your development work. What would you like to build next?";
    }
    
    if (normalizedQuery.includes('bye') || normalizedQuery.includes('goodbye')) {
      return "Goodbye! Come back anytime you need help with development tasks. 👋";
    }
    
    if (normalizedQuery.includes('how are you') || normalizedQuery.includes("how's it")) {
      return "I'm doing well and ready to help! I'm your AI development assistant. What project can I help you with today?";
    }
    
    // Default greeting response
    return "Hi there! 👋 I'm your AI development assistant. I can help you build features, fix bugs, analyze code, and more. What would you like to work on?";
  }
}
