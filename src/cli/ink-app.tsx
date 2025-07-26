import React from 'react';
import { render, Instance } from 'ink';
import { Arguments } from 'yargs';
import { GlobalOptionsMiddleware, GlobalContext } from './middleware/global-options.js';
import { ErrorHandler } from './errors/index.js';
import { commandRegistry } from './commands/index.js';
import { App } from '../ink/App.js';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onError: (error: Error) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error): void {
    this.props.onError(error);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

interface GraphynProviderProps {
  context: GlobalContext;
  children: React.ReactNode;
}

const GraphynContext = React.createContext<GlobalContext | null>(null);

export const GraphynProvider: React.FC<GraphynProviderProps> = ({ context, children }) => {
  return (
    <GraphynContext.Provider value={context}>
      {children}
    </GraphynContext.Provider>
  );
};

export const useGraphynContext = (): GlobalContext => {
  const context = React.useContext(GraphynContext);
  if (!context) {
    throw new Error('useGraphynContext must be used within GraphynProvider');
  }
  return context;
};

export class GraphynInkApp {
  private instance: Instance | null = null;
  
  static async run(argv: Arguments): Promise<void> {
    const app = new GraphynInkApp();
    
    try {
      // Initialize global context
      const context = await GlobalOptionsMiddleware.process(argv);
      
      // Check if we should use fallback mode
      if (!process.stdout.isTTY && !argv.forceInteractive) {
        return app.runFallback(context, argv);
      }
      
      // Render Ink app
      await app.renderInteractive(context, argv);
    } catch (error) {
      ErrorHandler.handle(error);
    }
  }
  
  private async renderInteractive(
    context: GlobalContext,
    argv: Arguments
  ): Promise<void> {
    const command = argv._[0] as string | undefined;
    const args = argv._.slice(1) as string[];
    
    const { unmount, waitUntilExit } = render(
      <ErrorBoundary onError={this.handleError}>
        <GraphynProvider context={context}>
          <App 
            command={command}
            query={args.join(' ')}
          />
        </GraphynProvider>
      </ErrorBoundary>
    );
    
    this.instance = { unmount, waitUntilExit } as Instance;
    
    // Proper signal handling
    const cleanup = () => {
      this.cleanup();
      process.exit(0);
    };
    
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    
    await waitUntilExit();
    this.cleanup();
  }
  
  private async runFallback(
    context: GlobalContext,
    argv: Arguments
  ): Promise<void> {
    const command = argv._[0] as string;
    const args = argv._.slice(1) as string[];
    
    context.logger.debug('Running in non-interactive mode');
    
    // Handle commands that can run without TTY
    const cmd = commandRegistry.get(command);
    if (!cmd) {
      throw new Error(`Unknown command: ${command}`);
    }
    
    // For now, just log that we would run the command
    context.logger.info(`Would run command: ${command} with args:`, args);
  }
  
  private handleError = (error: Error): void => {
    this.cleanup();
    ErrorHandler.handle(error);
  };
  
  private cleanup(): void {
    if (this.instance) {
      this.instance.unmount();
      this.instance = null;
    }
  }
}