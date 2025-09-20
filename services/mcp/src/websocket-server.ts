/**
 * MCP WebSocket Server - Real-time communication for Mission Control Dashboard
 * Provides WebSocket transport alongside stdio for live monitoring and control
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { TaskCoordinationServer } from './index.js';

export interface WebSocketMessage {
  type: 'task_update' | 'agent_status' | 'system_status' | 'error' | 'ping' | 'pong';
  data: any;
  timestamp: number;
  id?: string;
}

export interface ClientConnection {
  id: string;
  ws: WebSocket;
  subscriptions: Set<string>;
  lastSeen: Date;
  metadata: {
    userAgent?: string;
    sessionId?: string;
    clientType: 'dashboard' | 'cli' | 'api';
  };
}

export class MCPWebSocketServer extends EventEmitter {
  private wss: WebSocket.Server;
  private clients = new Map<string, ClientConnection>();
  private mcpServer: TaskCoordinationServer;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(port: number = 3002, mcpServer: TaskCoordinationServer) {
    super();
    this.mcpServer = mcpServer;
    
    this.wss = new WebSocket.Server({ 
      port,
      perMessageDeflate: true,
      maxPayload: 1024 * 1024 // 1MB max message size
    });

    this.setupWebSocketServer();
    this.setupMCPIntegration();
    this.startHeartbeat();

    console.log(`🌐 MCP WebSocket server listening on ws://localhost:${port}`);
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, req: any) => {
      const clientId = this.generateClientId();
      const userAgent = req.headers['user-agent'] || 'Unknown';
      const sessionId = req.headers['x-session-id'] as string || 'default';
      
      const client: ClientConnection = {
        id: clientId,
        ws,
        subscriptions: new Set(),
        lastSeen: new Date(),
        metadata: {
          userAgent,
          sessionId,
          clientType: this.detectClientType(userAgent)
        }
      };

      this.clients.set(clientId, client);
      
      console.log(`📱 Client connected: ${clientId} (${client.metadata.clientType})`);

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'system_status',
        data: {
          message: 'Connected to MCP WebSocket server',
          clientId,
          serverTime: new Date().toISOString(),
          mcpStatus: 'active'
        },
        timestamp: Date.now()
      });

      // Handle messages
      ws.on('message', (data: WebSocket.RawData) => {
        try {
          const message = JSON.parse(data.toString()) as WebSocketMessage;
          this.handleClientMessage(clientId, message);
        } catch (error) {
          console.error(`❌ Invalid message from ${clientId}:`, error);
          this.sendToClient(clientId, {
            type: 'error',
            data: { error: 'Invalid JSON message format' },
            timestamp: Date.now()
          });
        }
      });

      // Handle disconnection
      ws.on('close', () => {
        console.log(`📱 Client disconnected: ${clientId}`);
        this.clients.delete(clientId);
        this.emit('clientDisconnected', { clientId, client });
      });

      // Handle errors
      ws.on('error', (error: any) => {
        console.error(`❌ WebSocket error for ${clientId}:`, error);
        this.clients.delete(clientId);
      });

      this.emit('clientConnected', { clientId, client });
    });

    this.wss.on('error', (error: any) => {
      console.error('❌ WebSocket server error:', error);
    });
  }

  private setupMCPIntegration(): void {
    // Listen to MCP server events and broadcast to subscribed clients
    
    // Task updates
    this.mcpServer.on('taskEnqueued', (data: any) => {
      this.broadcast({
        type: 'task_update',
        data: { action: 'enqueued', ...data },
        timestamp: Date.now()
      }, 'tasks');
    });

    this.mcpServer.on('taskStarted', (data: any) => {
      this.broadcast({
        type: 'task_update',
        data: { action: 'started', ...data },
        timestamp: Date.now()
      }, 'tasks');
    });

    this.mcpServer.on('taskCompleted', (data: any) => {
      this.broadcast({
        type: 'task_update',
        data: { action: 'completed', ...data },
        timestamp: Date.now()
      }, 'tasks');
    });

    // Agent status updates
    this.mcpServer.on('agentStatusChanged', (data: any) => {
      this.broadcast({
        type: 'agent_status',
        data,
        timestamp: Date.now()
      }, 'agents');
    });

    // System status updates
    this.mcpServer.on('systemStatusChanged', (data: any) => {
      this.broadcast({
        type: 'system_status',
        data,
        timestamp: Date.now()
      }, 'system');
    });
  }

  private handleClientMessage(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastSeen = new Date();

    switch (message.type) {
      case 'ping':
        this.sendToClient(clientId, {
          type: 'pong',
          data: { timestamp: Date.now() },
          timestamp: Date.now(),
          id: message.id
        });
        break;

      case 'system_status':
        if (message.data?.subscribe) {
          // Subscribe to specific event types
          const subscriptions = Array.isArray(message.data.subscribe) 
            ? message.data.subscribe 
            : [message.data.subscribe];
          
          subscriptions.forEach((sub: any) => client.subscriptions.add(sub));
          
          this.sendToClient(clientId, {
            type: 'system_status',
            data: { 
              message: 'Subscription updated',
              subscriptions: Array.from(client.subscriptions)
            },
            timestamp: Date.now()
          });
        }
        break;

      default:
        console.warn(`⚠️ Unhandled message type from ${clientId}:`, message.type);
    }
  }

  private sendToClient(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      client.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(`❌ Failed to send message to ${clientId}:`, error);
      this.clients.delete(clientId);
    }
  }

  private broadcast(message: WebSocketMessage, subscription?: string): void {
    this.clients.forEach((client, clientId) => {
      // If subscription specified, only send to subscribed clients
      if (subscription && !client.subscriptions.has(subscription)) {
        return;
      }

      this.sendToClient(clientId, message);
    });
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const staleThreshold = 60000; // 1 minute

      // Remove stale clients
      this.clients.forEach((client, clientId) => {
        if (now - client.lastSeen.getTime() > staleThreshold) {
          console.log(`🧹 Removing stale client: ${clientId}`);
          client.ws.terminate();
          this.clients.delete(clientId);
          return;
        }

        // Send ping to active clients
        if (client.ws.readyState === WebSocket.OPEN) {
          this.sendToClient(clientId, {
            type: 'ping',
            data: { timestamp: now },
            timestamp: now
          });
        }
      });

      // Broadcast system status
      this.broadcast({
        type: 'system_status',
        data: {
          connectedClients: this.clients.size,
          uptime: process.uptime(),
          timestamp: now
        },
        timestamp: now
      }, 'system');

    }, 30000); // Every 30 seconds
  }

  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  private detectClientType(userAgent: string): 'dashboard' | 'cli' | 'api' {
    if (userAgent.includes('dashboard') || userAgent.includes('browser')) {
      return 'dashboard';
    }
    if (userAgent.includes('cli') || userAgent.includes('graphyn')) {
      return 'cli';
    }
    return 'api';
  }

  public getConnectedClients(): ClientConnection[] {
    return Array.from(this.clients.values());
  }

  public getClientStats(): any {
    return {
      totalClients: this.clients.size,
      clientTypes: {
        dashboard: Array.from(this.clients.values()).filter(c => c.metadata.clientType === 'dashboard').length,
        cli: Array.from(this.clients.values()).filter(c => c.metadata.clientType === 'cli').length,
        api: Array.from(this.clients.values()).filter(c => c.metadata.clientType === 'api').length,
      },
      totalSubscriptions: Array.from(this.clients.values()).reduce((sum, client) => sum + client.subscriptions.size, 0)
    };
  }

  public async close(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all client connections
    this.clients.forEach((client) => {
      client.ws.terminate();
    });
    this.clients.clear();

    // Close the server
    return new Promise((resolve, reject) => {
      this.wss.close((error: any) => {
        if (error) {
          reject(error);
        } else {
          console.log('🌐 MCP WebSocket server closed');
          resolve();
        }
      });
    });
  }
}