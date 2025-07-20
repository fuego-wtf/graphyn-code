// Fuego-inspired dark theme colors
export const fuegoColors = {
  // Primary background gradient colors (from fuego.wtf)
  gradient: {
    color1: '#1A2942', // Deep blue-gray
    color2: '#162236', // Dark blue-gray
    color3: '#131D2E', // Darker blue-gray
    color4: '#0F1825', // Darkest blue-gray
    color5: '#000000', // Pure black
  },
  
  // Older gradient (from index.css)
  gradientAlt: {
    color1: '#2E1D4A', // Deep purple
    color2: '#130B24', // Dark purple
    color3: '#0B1A26', // Dark blue
    color4: '#102C35', // Dark teal
  },
  
  // UI Colors (translated for terminal)
  text: {
    primary: '#FAFBFC',   // Near white
    secondary: '#B2BED1', // Muted blue-gray
    dimmed: '#6B7C95',    // Dimmed text
  },
  
  // Accent colors for terminal (bright versions)
  accent: {
    blue: 'blue',         // Terminal blue
    cyan: 'cyan',         // Terminal cyan
    magenta: 'magenta',   // Terminal magenta
    gray: 'gray',         // Terminal gray
  },
  
  // Special colors
  border: {
    subtle: 'gray',       // Subtle borders
    accent: 'cyan',       // Accent borders
  }
};

// Color theme helpers
export const getGradientName = () => {
  // For terminals that support gradients, we'll use a blue-purple gradient
  // Otherwise fallback to cyan
  return 'cyan-blue';
};

export const getAccentColor = (isSelected: boolean = false) => {
  return isSelected ? 'cyan' : 'white';
};

export const getDimColor = () => 'gray';

export const getErrorColor = () => 'red';

export const getSuccessColor = () => 'green';