import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Text } from 'ink';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Box flexDirection="column" padding={1}>
          <Text color="red" bold>❌ Something went wrong</Text>
          <Box marginTop={1} flexDirection="column">
            <Text color="yellow">Error: {this.state.error?.message}</Text>
            {process.env.NODE_ENV === 'development' && (
              <Box marginTop={1} flexDirection="column">
                <Text dimColor>Stack trace:</Text>
                <Text dimColor>{this.state.error?.stack}</Text>
              </Box>
            )}
          </Box>
          <Box marginTop={2}>
            <Text dimColor>Please restart the application</Text>
          </Box>
        </Box>
      );
    }

    return this.props.children;
  }
}