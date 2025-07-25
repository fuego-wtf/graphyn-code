export const pixelTheme = {
  colors: {
    // Background colors
    outerFrame: '#4A4A4A',     // Outer gray
    innerFrame: '#3A3A3A',     // Title bar gray
    terminal: 'black',         // Terminal black
    
    // Text colors
    text: '#E0E0E0',           // Light gray text
    accent: '#FF5500',         // Orange highlight
    dim: 'gray',               // Dimmed text
    
    // UI colors
    white: 'white',
    gray: 'gray',
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