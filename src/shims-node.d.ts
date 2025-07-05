declare module 'os' {
  const value: any;
  export = value;
}

declare module 'child_process' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function execSync(command: string, options?: any): Buffer;
}

declare module 'path' {
  const value: any;
  export = value;
}

declare module 'fs' {
  const value: any;
  export = value;
}

// Stubs for external libraries without type declarations installed

declare module 'axios' {
  const value: any;
  export = value;
}

declare module 'chokidar' {
  import { EventEmitter } from 'events';

  export interface WatchOptions {
    ignored?: string | RegExp | ((path: string) => boolean);
    persistent?: boolean;
    ignoreInitial?: boolean;
    followSymlinks?: boolean;
    cwd?: string;
    depth?: number;
    awaitWriteFinish?: {
      stabilityThreshold?: number;
      pollInterval?: number;
    } | boolean;
  }

  export interface FSWatcher extends EventEmitter {
    add(paths: string | ReadonlyArray<string>): void;
    unwatch(paths: string | ReadonlyArray<string>): void;
    close(): Promise<void>;
    on(event: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir', listener: (path: string) => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: 'ready' | 'raw', listener: () => void): this;
  }

  export function watch(paths: string | ReadonlyArray<string>, options?: WatchOptions): FSWatcher;
}

declare module 'events' {
  export class EventEmitter {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(event: string | symbol, listener: (...args: any[]) => void): this;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    emit(event: string | symbol, ...args: any[]): boolean;
  }
}