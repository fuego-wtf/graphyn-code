import React, { useState, useEffect } from 'react';
import { Text } from 'ink';

interface DynamicIconProps {
  type: 'spinner' | 'pulse' | 'rotate' | 'blink';
  color?: string;
}

export const DynamicIcon: React.FC<DynamicIconProps> = ({ type, color = 'cyan' }) => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(prev => prev + 1);
    }, type === 'spinner' ? 80 : 200);

    return () => clearInterval(interval);
  }, [type]);

  const getIcon = () => {
    switch (type) {
      case 'spinner':
        const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        return spinnerFrames[frame % spinnerFrames.length];
      
      case 'pulse':
        const pulseFrames = ['◯', '◉', '●', '◉'];
        return pulseFrames[frame % pulseFrames.length];
      
      case 'rotate':
        const rotateFrames = ['◐', '◓', '◑', '◒'];
        return rotateFrames[frame % rotateFrames.length];
      
      case 'blink':
        return frame % 2 === 0 ? '▪' : '▫';
      
      default:
        return '•';
    }
  };

  return <Text color={color}>{getIcon()}</Text>;
};