#!/usr/bin/env node

import React from 'react';
import { render } from 'ink';
import { EnhancedUXDemo } from './components/EnhancedUXDemo.js';

// Main demo application
const App: React.FC = () => {
  return <EnhancedUXDemo />;
};

// Render the application
const { waitUntilExit } = render(<App />);

// Handle exit
waitUntilExit().then(() => {
  process.exit(0);
});