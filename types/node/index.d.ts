/** Minimal Node.js global definitions stub */
/* eslint-disable @typescript-eslint/no-explicit-any */

declare const __dirname: string;
declare const __filename: string;
declare const console: Console;

interface Console {
  log(...args: any[]): void;
  error(...args: any[]): void;
  warn(...args: any[]): void;
  info(...args: any[]): void;
}

declare namespace NodeJS {
  interface Process {
    env: { [key: string]: string | undefined };
    argv: string[];
    cwd(): string;
    exit(code?: number): never;
  }
}

declare const process: NodeJS.Process;