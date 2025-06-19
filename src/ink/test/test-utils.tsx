import React, { ReactElement } from 'react';
import { render as inkRender, RenderOptions } from 'ink-testing-library';
import { APIProvider } from '../contexts/APIContext.js';
import { ErrorBoundary } from '../components/ErrorBoundary.js';

interface TestProviderProps {
  children: React.ReactNode;
}

const TestProvider: React.FC<TestProviderProps> = ({ children }) => {
  return (
    <ErrorBoundary>
      <APIProvider>
        {children}
      </APIProvider>
    </ErrorBoundary>
  );
};

export const render = (ui: ReactElement, options?: RenderOptions) => {
  return inkRender(<TestProvider>{ui}</TestProvider>, options);
};

export * from 'ink-testing-library';