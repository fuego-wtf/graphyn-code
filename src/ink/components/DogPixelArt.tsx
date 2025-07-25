import React from 'react';
import { Box, Text } from 'ink';

interface DogPixelArtProps {
  scale?: 1 | 2;
  color?: string;
}

export const DogPixelArt: React.FC<DogPixelArtProps> = ({ scale = 1, color = '#FF5500' }) => {
  // Exact pixel grid based on CSS positions (11x11 grid where each cell = 9.09%)
  // '█' = filled pixel (#FF5500), ' ' = empty, '▓' = black pixel
  const pixelGrid = [
    '   █     ██', // Row 0: 27.27%, 72.73%-81.82%
    '  █      ██', // Row 1: 18.18%, 72.73%-81.82%
    '  █      █ ', // Row 2: 18.18%, 72.73%
    '  █      █ ', // Row 3: 18.18%, 72.73%
    '  ████████ ', // Row 4: 18.18%-81.82%
    ' ██████████', // Row 5: 9.09%-90.91%
    ' ██████████', // Row 6: 9.09%-90.91%
    '███████████', // Row 7: 0%-90.91%
    '█ ██ ██ ██ ', // Row 8: legs pattern
    '█ ██    ██ ', // Row 9: feet pattern  
    '██████████▓', // Row 10: 0%-81.82% orange, 81.82%-90.91% black
  ];

  if (scale === 2) {
    // Double the size for scale=2
    const scaledGrid: string[] = [];
    pixelGrid.forEach(row => {
      const scaledRow = row.split('').map(char => char + char).join('');
      scaledGrid.push(scaledRow);
      scaledGrid.push(scaledRow);
    });
    
    return (
      <Box flexDirection="column">
        {scaledGrid.map((row, rowIndex) => (
          <Box key={rowIndex} flexDirection="row">
            {row.split('').map((char, colIndex) => (
              <Text 
                key={colIndex} 
                color={char === '▓' ? '#000000' : (char === ' ' ? undefined : color)}
              >
                {char === '▓' ? '█' : char}
              </Text>
            ))}
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {pixelGrid.map((row, rowIndex) => (
        <Box key={rowIndex} flexDirection="row">
          {row.split('').map((char, colIndex) => (
            <Text 
              key={colIndex} 
              color={char === '▓' ? '#000000' : (char === ' ' ? undefined : color)}
            >
              {char === '▓' ? '█' : char}
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  );
};

// Compact version for inline use
export const DogPixelArtCompact: React.FC<{ color?: string }> = ({ color = '#FF5500' }) => {
  const compactDog = '🦴'; // Using dog bone emoji as compact representation
  
  return <Text color={color}>{compactDog}</Text>;
};

// Horizontal dog for banners
export const DogPixelArtHorizontal: React.FC<{ color?: string }> = ({ color = '#FF5500' }) => {
  return (
    <Box>
      <Text color={color}>▗▖ ▗▄▄▖ ▗▄▄▄▖</Text>
    </Box>
  );
};