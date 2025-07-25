export const pixelTheme = {
  colors: {
    // Background colors
    outerFrame: '#131313',     // Dark terminal background
    innerFrame: '#1a1a1a',     // Slightly lighter header
    terminal: '#131313',       // Terminal black from Figma
    
    // Text colors
    text: '#FFFFFF',           // White text from Figma
    accent: '#FF5500',         // Orange highlight (unchanged)
    dim: '#808080',            // Gray for secondary text
    
    // UI colors
    white: '#FFFFFF',
    gray: '#808080',
    orange: '#FF5500',
  },
  
  // Box drawing characters for frames
  characters: {
    // Corners
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    
    // Lines
    horizontal: '─',
    vertical: '│',
    
    // Junctions
    cross: '┼',
    teeDown: '┬',
    teeUp: '┴',
    teeRight: '├',
    teeLeft: '┤',
    
    // Menu styling
    menuPrefix: '└─',
    menuPrefixHover: '└─',
    
    // Cursor
    cursor: '█',
    blinkingCursor: '_',
    
    // Pixel blocks for art
    fullBlock: '█',
    upperHalf: '▀',
    lowerHalf: '▄',
    leftHalf: '▌',
    rightHalf: '▐',
    shade: '░',
    mediumShade: '▒',
    darkShade: '▓',
    
    // Window controls
    windowButton: '●',
  },
  
  // Animation timings
  animations: {
    cursorBlink: 500,      // milliseconds
    typewriter: 50,        // milliseconds per character
    fadeIn: 300,           // milliseconds
  },
  
  // Layout constants
  layout: {
    terminalWidth: 80,
    terminalMinHeight: 20,
    padding: 2,
  }
};

// Helper functions
export const applyPixelTheme = {
  // Apply orange highlight on hover
  highlight: (text: string, isHovered: boolean) => 
    isHovered ? text : text,
  
  // Apply dim style
  dim: (text: string) => text,
  
  // Create menu item with prefix
  menuItem: (text: string, isSelected: boolean) => {
    const prefix = pixelTheme.characters.menuPrefix;
    return `${prefix} ${text}`;
  },
  
  // Create a pixel border
  pixelBorder: (width: number, height: number) => {
    const h = pixelTheme.characters.horizontal.repeat(width - 2);
    const top = `${pixelTheme.characters.topLeft}${h}${pixelTheme.characters.topRight}`;
    const bottom = `${pixelTheme.characters.bottomLeft}${h}${pixelTheme.characters.bottomRight}`;
    const middle = Array(height - 2).fill(
      `${pixelTheme.characters.vertical}${' '.repeat(width - 2)}${pixelTheme.characters.vertical}`
    );
    
    return {
      top,
      middle,
      bottom
    };
  }
};