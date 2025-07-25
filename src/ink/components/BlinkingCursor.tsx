import React, { useState, useEffect } from 'react';
import { Text } from 'ink';
import { pixelTheme } from '../theme/pixelart.js';

interface BlinkingCursorProps {
  color?: string;
  character?: string;
}

export const BlinkingCursor: React.FC<BlinkingCursorProps> = ({ 
  color,
  character = pixelTheme.characters.cursor
}) => {
  const [visible, setVisible] = useState(true);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(v => !v);
    }, pixelTheme.animations.cursorBlink);
    
    return () => clearInterval(timer);
  }, []);
  
  return (
    <Text color={color || pixelTheme.colors.accent}>
      {visible ? character : ' '}
    </Text>
  );
};