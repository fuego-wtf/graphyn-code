/**
 * REV-071: Split-Screen Interface - Main Coordinator
 * 
 * Orchestrates the three panels (output, approval, input) and manages
 * the complete split-screen user interface with real-time updates.
 */

import { EventEmitter } from 'events';
import { TerminalLayoutManager, LayoutConfiguration } from './TerminalLayoutManager.js';
import { StreamingOutputPanel, StreamContent, AgentStatus } from './StreamingOutputPanel.js';
import { ApprovalWorkflowPanel, TaskDecomposition, TaskStatus } from './ApprovalWorkflowPanel.js';
import { ContinuousInputPanel, RepositoryContext } from './ContinuousInputPanel.js';
import { EnhancedInputHandler, InputContext, InputSubmissionEvent } from '../../console/EnhancedInputHandler.js';
import { ExitProtectionHandler, ExitState, ExitContext } from '../exit-protection/ExitProtectionHandler.js';
import { ANSIController } from './ANSIController.js';

export interface SplitScreenConfig {
  terminalDimensions: {
    width: number;
    height: number;
  };
  enableExitProtection?: boolean;
  enableRepositoryContext?: boolean;
  enableAnimation?: boolean;
  updateInterval?: number;
}

export interface ExecutionEvent {
  type: string;
  data: any;
  timestamp: Date;
  source?: string;
}

export interface SplitScreenState {
  isActive: boolean;
  currentLayout: LayoutConfiguration;
  inputContext: InputContext;
  exitState: ExitState;
  hasActiveExecution: boolean;
  repositoryContext?: RepositoryContext;
}

export class SplitScreenInterface extends EventEmitter {
  private layoutManager: TerminalLayoutManager;
  private outputPanel: StreamingOutputPanel;
  private approvalPanel: ApprovalWorkflowPanel;
  private inputPanel: ContinuousInputPanel;
  private inputHandler: EnhancedInputHandler;
  private exitProtectionHandler: ExitProtectionHandler;
  
  // State management
  private isActive: boolean = false;
  private currentLayout: LayoutConfiguration;
  private config: SplitScreenConfig;
  
  // Event processing
  private updateTimer?: NodeJS.Timeout;
  private pendingUpdates: ExecutionEvent[] = [];
  
  // Animation and rendering
  private animationFrame: number = 0;
  private lastRenderTime: Date = new Date();

  constructor(config: SplitScreenConfig) {
    super();
    
    this.config = {
      enableExitProtection: true,
      enableRepositoryContext: true,
      enableAnimation: true,
      updateInterval: 16, // 60 FPS
      ...config
    };
    
    // Initialize components
    this.layoutManager = new TerminalLayoutManager();
    this.inputHandler = new EnhancedInputHandler({
      enableHistory: true,
      enableAutoComplete: true,
      placeholder: 'graphyn>'
    });
    
    // Get initial layout
    this.currentLayout = this.layoutManager.getCurrentLayout();
    
    // Initialize panels
    this.outputPanel = new StreamingOutputPanel(this.currentLayout.outputPanel);
    this.approvalPanel = new ApprovalWorkflowPanel(this.currentLayout.approvalPanel);
    this.inputPanel = new ContinuousInputPanel(this.currentLayout.inputPanel, this.inputHandler);
    
    // Initialize exit protection
    this.exitProtectionHandler = new ExitProtectionHandler({
      confirmationTimeout: 5000,
      executionProtection: this.config.enableExitProtection
    });
    
    this.setupEventHandlers();
  }

  /**
   * Setup event handlers for all components
   */
  private setupEventHandlers(): void {
    // Layout manager events
    this.layoutManager.on('layoutChanged', (layout: LayoutConfiguration) => {
      this.handleLayoutChange(layout);
    });

    // Input handler events
    this.inputHandler.on('inputSubmitted', (event: InputSubmissionEvent) => {
      this.handleInputSubmission(event);
    });

    this.inputHandler.on('contextChanged', (event: any) => {
      this.handleInputContextChange(event);
    });

    // Navigation events from input
    this.inputHandler.on('navigationRequest', (event: any) => {
      this.handleNavigationRequest(event);
    });

    // Approval workflow events
    this.inputHandler.on('taskApprovalToggle', () => {
      this.approvalPanel.toggleTaskApproval();
    });

    this.inputHandler.on('approveAllTasks', () => {
      this.approvalPanel.approveAllTasks();
    });

    this.inputHandler.on('modifyExecutionPlan', () => {
      this.emit('modifyExecutionPlan');
    });

    this.inputHandler.on('provideFeedback', () => {
      this.emit('provideFeedback');
    });

    this.inputHandler.on('cancelExecution', () => {
      this.emit('cancelExecution');
    });

    // Approval panel events
    this.approvalPanel.on('taskSelectionChanged', (index) => {
      this.emit('taskSelectionChanged', index);
    });

    this.approvalPanel.on('taskApprovalToggled', (event) => {
      this.emit('taskApprovalToggled', event);
    });

    this.approvalPanel.on('allTasksApproved', (taskIds) => {
      this.emit('allTasksApproved', taskIds);
    });

    // Output panel events
    this.outputPanel.on('contentAdded', (content) => {
      this.emit('outputContentAdded', content);
    });

    this.outputPanel.on('agentStatusChanged', (event) => {
      this.emit('agentStatusChanged', event);
      this.updateExecutionContext();
    });

    // Input panel events (repository context)
    this.inputPanel.on('repositoryContextUpdated', (event) => {
      this.emit('repositoryContextUpdated', event);
    });

    // Exit protection events
    this.exitProtectionHandler.on('exitConfirmed', () => {
      this.emit('exitRequested');
    });

    this.exitProtectionHandler.on('exitCancelled', () => {
      this.emit('exitCancelled');
      this.resumeInterface();
    });

    // System events
    process.on('SIGWINCH', () => {
      this.handleTerminalResize();
    });
  }

  /**
   * Initialize and start the split-screen interface
   */
  async initialize(): Promise<void> {
    if (this.isActive) {
      return;
    }

    // Check terminal dimensions
    if (!this.layoutManager.isValidForSplitScreen()) {
      const minDims = this.layoutManager.getMinimumDimensions();
      throw new Error(
        `Terminal too small for split-screen interface. ` +
        `Minimum required: ${minDims.width}x${minDims.height}`
      );
    }

    // Setup alternate screen buffer for clean display
    process.stdout.write(ANSIController.enterAlternateScreen());
    process.stdout.write(ANSIController.clearScreen());
    process.stdout.write(ANSIController.hideCursor());

    // Start input handling
    this.inputHandler.start();

    // Initialize repository context if enabled
    if (this.config.enableRepositoryContext) {
      await this.inputPanel.refreshRepositoryContext();
    }

    // Start animation if enabled
    if (this.config.enableAnimation) {
      this.outputPanel.startAnimation();
      this.startUpdateLoop();
    }

    this.isActive = true;
    this.render();
    
    this.emit('initialized');
  }

  /**
   * Start the interface and begin interaction
   */
  async startInterface(): Promise<void> {
    if (!this.isActive) {
      await this.initialize();
    }

    // Set input context to normal operation
    this.setInputContext(InputContext.NORMAL);
    
    // Perform initial render
    this.render();
    
    // Display welcome message
    this.addOutput({
      id: `welcome-${Date.now()}`,
      source: 'system',
      content: '🎯 Split-screen interface initialized. Enhanced UX Phase 2 active.',
      timestamp: new Date(),
      type: 'success'
    });

    this.emit('interfaceStarted');
  }

  /**
   * Handle layout changes (terminal resize, etc.)
   */
  private handleLayoutChange(layout: LayoutConfiguration): void {
    this.currentLayout = layout;
    
    // Update panel configurations
    this.outputPanel.updatePanelConfig(layout.outputPanel);
    this.approvalPanel.updatePanelConfig(layout.approvalPanel);
    this.inputPanel.updatePanelConfig(layout.inputPanel);
    
    // Re-render interface
    this.render();
    
    this.emit('layoutChanged', layout);
  }

  /**
   * Handle input submissions
   */
  private handleInputSubmission(event: InputSubmissionEvent): void {
    // Add input to output panel as user message
    this.addOutput({
      id: `input-${Date.now()}`,
      source: 'user',
      content: event.content,
      timestamp: event.timestamp,
      type: 'text',
      metadata: { context: event.context }
    });

    this.emit('userInput', event);
  }

  /**
   * Handle input context changes
   */
  private handleInputContextChange(event: any): void {
    // Update input panel based on new context
    this.inputPanel.setInputContext(event.newContext);
    this.emit('inputContextChanged', event);
  }

  /**
   * Handle navigation requests
   */
  private handleNavigationRequest(event: { direction: 'up' | 'down' }): void {
    const context = this.inputHandler.getContext();
    
    if (context === InputContext.APPROVAL) {
      // Navigate tasks in approval panel
      this.approvalPanel.navigateTask(event.direction);
    } else {
      // Handle other navigation contexts
      this.emit('navigationRequest', event);
    }
  }

  /**
   * Handle terminal resize
   */
  private handleTerminalResize(): void {
    // Small delay to let terminal settle
    setTimeout(() => {
      this.layoutManager.recalculateLayout();
    }, 100);
  }

  /**
   * Start the update loop for smooth animations
   */
  private startUpdateLoop(): void {
    if (this.updateTimer) {
      return;
    }

    this.updateTimer = setInterval(() => {
      this.processUpdates();
      this.animationFrame++;
    }, this.config.updateInterval);
  }

  /**
   * Stop the update loop
   */
  private stopUpdateLoop(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = undefined;
    }
  }

  /**
   * Process pending updates
   */
  private processUpdates(): void {
    if (this.pendingUpdates.length === 0) {
      return;
    }

    const updates = [...this.pendingUpdates];
    this.pendingUpdates = [];

    updates.forEach(update => {
      this.handleExecutionEvent(update);
    });
  }

  /**
   * Handle execution events from the orchestrator
   */
  handleExecutionEvent(event: ExecutionEvent): void {
    switch (event.type) {
      case 'task_decomposition':
        this.showTaskDecomposition(event.data);
        break;
        
      case 'approval_required':
        this.requestApproval(event.data);
        break;
        
      case 'task_started':
        this.handleTaskStarted(event.data);
        break;
        
      case 'agent_response':
        this.addOutput({
          id: `response-${Date.now()}`,
          source: event.data.agentName || 'agent',
          content: event.data.content || event.data.text,
          timestamp: event.timestamp,
          type: 'text',
          metadata: event.data
        });
        break;
        
      case 'agent_status_update':
        this.updateAgentStatus(event.data.agentName, event.data.status);
        break;
        
      case 'execution_complete':
        this.handleExecutionComplete(event.data);
        break;
        
      case 'execution_error':
        this.addOutput({
          id: `error-${Date.now()}`,
          source: event.data.agentName || 'system',
          content: event.data.message || 'Unknown error occurred',
          timestamp: event.timestamp,
          type: 'error',
          metadata: event.data
        });
        break;
        
      default:
        // Handle unknown event types
        this.addOutput({
          id: `event-${Date.now()}`,
          source: event.source || 'system',
          content: `Event: ${event.type}`,
          timestamp: event.timestamp,
          type: 'text',
          metadata: event.data
        });
    }
  }

  /**
   * Show task decomposition in approval panel
   */
  showTaskDecomposition(decomposition: TaskDecomposition): void {
    this.approvalPanel.displayTaskDecomposition(decomposition);
    this.setInputContext(InputContext.APPROVAL);
    
    // Add summary to output
    this.addOutput({
      id: `decomposition-${Date.now()}`,
      source: 'system',
      content: `📋 Task decomposition generated: ${decomposition.tasks.length} tasks planned`,
      timestamp: new Date(),
      type: 'task_decomposition',
      metadata: { decomposition }
    });
  }

  /**
   * Request user approval for execution plan
   */
  async requestApproval(decomposition: TaskDecomposition): Promise<boolean> {
    return new Promise((resolve) => {
      this.approvalPanel.setApprovalMode('approval');
      this.setInputContext(InputContext.APPROVAL);
      
      // Listen for approval decision
      const handleApproval = (taskIds: string[]) => {
        this.approvalPanel.removeListener('allTasksApproved', handleApproval);
        this.approvalPanel.removeListener('cancelExecution', handleCancel);
        resolve(true);
      };
      
      const handleCancel = () => {
        this.approvalPanel.removeListener('allTasksApproved', handleApproval);
        this.approvalPanel.removeListener('cancelExecution', handleCancel);
        resolve(false);
      };
      
      this.approvalPanel.once('allTasksApproved', handleApproval);
      this.approvalPanel.once('cancelExecution', handleCancel);
    });
  }

  /**
   * Handle task started event
   */
  private handleTaskStarted(data: any): void {
    this.approvalPanel.setApprovalMode('execution');
    this.setInputContext(InputContext.EXECUTION);
    
    this.addOutput({
      id: `task-start-${Date.now()}`,
      source: data.agentName || 'system',
      content: `🚀 Started: ${data.taskTitle || data.taskId}`,
      timestamp: new Date(),
      type: 'progress'
    });
    
    this.updateExecutionContext();
  }

  /**
   * Handle execution complete event
   */
  private handleExecutionComplete(data: any): void {
    this.approvalPanel.setApprovalMode('complete');
    this.setInputContext(InputContext.NORMAL);
    
    this.addOutput({
      id: `execution-complete-${Date.now()}`,
      source: 'system',
      content: '🎉 Execution completed successfully!',
      timestamp: new Date(),
      type: 'success'
    });
    
    this.updateExecutionContext();
  }

  /**
   * Add content to output panel
   */
  addOutput(content: StreamContent): void {
    this.outputPanel.addContent(content);
  }

  /**
   * Update agent status
   */
  updateAgentStatus(agentName: string, status: AgentStatus): void {
    this.outputPanel.updateAgentStatus(agentName, status);
    this.updateExecutionContext();
  }

  /**
   * Set input context
   */
  setInputContext(context: InputContext): void {
    this.inputHandler.setContext(context);
    this.inputPanel.setInputContext(context);
  }

  /**
   * Update execution context for exit protection
   */
  private updateExecutionContext(): void {
    // This would be populated with real execution data
    const context: ExitContext = {
      isExecuting: this.inputHandler.getContext() === InputContext.EXECUTION,
      activeAgents: [], // Would be populated from agent status
      hasUnsavedWork: false, // Would be determined from current state
      currentTasks: [] // Would be populated from approval panel
    };
    
    this.exitProtectionHandler.updateExecutionContext(context);
  }

  /**
   * Main render method
   */
  render(): void {
    if (!this.isActive) {
      return;
    }

    // Update render timestamp
    this.lastRenderTime = new Date();
    
    // Render all panels
    this.outputPanel.render();
    this.approvalPanel.render();
    this.inputPanel.render();
    
    this.emit('rendered', {
      timestamp: this.lastRenderTime,
      animationFrame: this.animationFrame
    });
  }

  /**
   * Resume interface after exit cancellation
   */
  resumeInterface(): void {
    // Clear any exit confirmation UI and restore normal operation
    process.stdout.write(ANSIController.clearScreen());
    this.render();
    this.emit('resumed');
  }

  /**
   * Get current interface state
   */
  getState(): SplitScreenState {
    return {
      isActive: this.isActive,
      currentLayout: this.currentLayout,
      inputContext: this.inputHandler.getContext(),
      exitState: this.exitProtectionHandler.getState(),
      hasActiveExecution: this.inputHandler.getContext() === InputContext.EXECUTION,
      repositoryContext: this.inputPanel.getRepositoryContext()
    };
  }

  /**
   * Clean shutdown
   */
  async cleanup(): Promise<void> {
    if (!this.isActive) {
      return;
    }

    this.stopUpdateLoop();
    
    // Stop animations
    this.outputPanel.stopAnimation();
    this.approvalPanel.stopAnimation();
    
    // Clean up components
    this.inputHandler.cleanup();
    this.outputPanel.cleanup();
    this.approvalPanel.cleanup();
    this.inputPanel.cleanup();
    this.layoutManager.cleanup();
    this.exitProtectionHandler.cleanup();
    
    // Restore terminal
    process.stdout.write(ANSIController.showCursor());
    process.stdout.write(ANSIController.exitAlternateScreen());
    
    this.isActive = false;
    this.removeAllListeners();
    
    this.emit('cleaned');
  }
}