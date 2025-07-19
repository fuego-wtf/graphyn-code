import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '../../test/test-utils.js';
import { Loading } from '../Loading.js';

describe('Loading', () => {
  it('renders default message', () => {
    const { lastFrame } = render(<Loading />);
    expect(lastFrame()).toContain('Loading...');
  });

  it('renders custom message', () => {
    const { lastFrame } = render(<Loading message="Processing request..." />);
    expect(lastFrame()).toContain('Processing request...');
  });

  it('shows spinner', () => {
    const { lastFrame } = render(<Loading />);
    // Spinner component will show one of these characters
    const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    const hasSpinner = spinnerChars.some(char => lastFrame().includes(char));
    expect(hasSpinner).toBe(true);
  });
});