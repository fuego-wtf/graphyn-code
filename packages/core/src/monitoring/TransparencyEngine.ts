import { appendFile } from 'fs/promises';
import { EventEmitter } from 'events';
import path from 'path';
import type {
  TransparencyEvent,
  TransparencyStore,
} from '@graphyn/db';

export interface TransparencyEngineOptions {
  sessionId?: string;
  logDirectory?: string;
  db: TransparencyStore;
}

export interface TransparencyRecordInput {
  level?: 'info' | 'warn' | 'error' | 'debug';
  source: string;
  eventType: string;
  message: string;
  metadata?: Record<string, any>;
  eventTime?: Date;
}

export class TransparencyEngine {
  private readonly sessionId?: string;
  private readonly logFile?: string;
  private readonly db: TransparencyStore;
  private readonly emitter = new EventEmitter();

  constructor(options: TransparencyEngineOptions) {
    this.sessionId = options.sessionId;
    this.db = options.db;
    if (options.logDirectory) {
      this.logFile = path.join(options.logDirectory, 'transparency.log');
    }
  }

  attachTo(coordinator: EventEmitter): void {
    coordinator.on('mcp:tool-call', (payload) => {
      this.record({
        level: 'info',
        source: 'mcp',
        eventType: 'tool_call',
        message: `${payload.name}`,
        metadata: payload,
      });
    });

    coordinator.on('mcp:tool-response', (payload) => {
      this.record({
        level: payload.success ? 'info' : 'warn',
        source: 'mcp',
        eventType: payload.success ? 'tool_response' : 'tool_error',
        message: `${payload.name}`,
        metadata: payload,
      });
    });

    coordinator.on('mcp:process-log', (payload) => {
      this.record({
        level: 'debug',
        source: 'mcp',
        eventType: 'process_log',
        message: payload.message,
      });
    });
  }

  async record(entry: TransparencyRecordInput): Promise<void> {
    const event: TransparencyEvent = {
      sessionId: this.sessionId,
      source: entry.source,
      level: entry.level ?? 'info',
      eventType: entry.eventType,
      message: entry.message,
      metadata: entry.metadata,
      eventTime: entry.eventTime ?? new Date(),
    };

    await this.db.recordTransparencyEvent(event);
    this.emitter.emit('event', event);

    if (this.logFile) {
      const line = `${event.eventTime?.toISOString()} [${event.level.toUpperCase()}] ${event.source}::${event.eventType} - ${event.message}${
        event.metadata ? ` ${JSON.stringify(event.metadata)}` : ''
      }\n`;
      await appendFile(this.logFile, line);
    }
  }

  onEvent(listener: (event: TransparencyEvent) => void): void {
    this.emitter.on('event', listener);
  }
}

export default TransparencyEngine;
