#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import CockpitMonitor from './components/CockpitMonitor.js';
import type { Task } from '../services/claude-task-generator.js';
import type { AgentConfig } from '../services/squad-storage.js';

// Parse command line arguments
const args = process.argv.slice(2);
let tasks: Task[] = [];
let agents: AgentConfig[] = [];
let sessionName = 'graphyn-cockpit';

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg.startsWith('--tasks=')) {
    try {
      tasks = JSON.parse(arg.substring(8));
    } catch (error) {
      console.error('Failed to parse tasks:', error);
      process.exit(1);
    }
  } else if (arg.startsWith('--agents=')) {
    try {
      agents = JSON.parse(arg.substring(9));
    } catch (error) {
      console.error('Failed to parse agents:', error);
      process.exit(1);
    }
  } else if (arg.startsWith('--session=')) {
    sessionName = arg.substring(10);
  }
}

if (tasks.length === 0) {
  console.error('No tasks provided. Use --tasks=\'[...]\' to specify tasks.');
  process.exit(1);
}

if (agents.length === 0) {
  console.error('No agents provided. Use --agents=\'[...]\' to specify agents.');
  process.exit(1);
}

// Render the Cockpit Monitor
const app = render(
  <CockpitMonitor 
    tasks={tasks} 
    agents={agents} 
    sessionName={sessionName} 
  />
);

// Handle graceful shutdown
process.on('SIGINT', () => {
  app.unmount();
  process.exit(0);
});

process.on('SIGTERM', () => {
  app.unmount();
  process.exit(0);
});