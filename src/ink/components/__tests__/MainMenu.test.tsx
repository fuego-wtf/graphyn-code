import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '../../test/test-utils.js';
import { MainMenu } from '../MainMenu.js';

describe('MainMenu', () => {
  it('renders without crashing', () => {
    const onSelect = vi.fn();
    const { lastFrame } = render(<MainMenu onSelect={onSelect} />);
    
    expect(lastFrame()).toContain('GRAPHYN');
    expect(lastFrame()).toContain('AI Development Tool for Claude Code');
  });

  it('displays all menu items', () => {
    const onSelect = vi.fn();
    const { lastFrame } = render(<MainMenu onSelect={onSelect} />);
    
    expect(lastFrame()).toContain('Backend Agent');
    expect(lastFrame()).toContain('Frontend Agent');
    expect(lastFrame()).toContain('Architect Agent');
    expect(lastFrame()).toContain('Design Agent');
    expect(lastFrame()).toContain('CLI Agent');
    expect(lastFrame()).toContain('Manage Threads');
    expect(lastFrame()).toContain('Authentication');
    expect(lastFrame()).toContain('Doctor');
    expect(lastFrame()).toContain('Exit');
  });

  it('shows navigation help text', () => {
    const onSelect = vi.fn();
    const { lastFrame } = render(<MainMenu onSelect={onSelect} />);
    
    expect(lastFrame()).toContain('Navigate');
    expect(lastFrame()).toContain('Select');
    expect(lastFrame()).toContain('Help');
    expect(lastFrame()).toContain('Exit');
  });
});