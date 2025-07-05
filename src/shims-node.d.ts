declare module 'os' {
  const value: any;
  export = value;
}

declare module 'child_process' {
  const value: any;
  export = value;
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
  const value: any;
  export = value;
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