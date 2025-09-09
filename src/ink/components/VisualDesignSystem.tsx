import React from 'react';
import { Box, Text } from 'ink';
import { fuegoColors, colors } from '../theme/colors.js';

// Enhanced visual components following "spacecraft piloting" aesthetic

// Professional Typography Component
interface TypographyProps {
  variant: 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'code';
  color?: string;
  children: React.ReactNode;
  bold?: boolean;
  dimColor?: boolean;
}

export const Typography: React.FC<TypographyProps> = ({
  variant,
  color,
  children,
  bold = false,
  dimColor = false
}) => {
  const getTypographyColor = () => {
    if (color) return color;
    
    switch (variant) {
      case 'h1':
        return fuegoColors.text.primary;
      case 'h2':
        return fuegoColors.text.primary;
      case 'h3':
        return fuegoColors.text.secondary;
      case 'body':
        return fuegoColors.text.secondary;
      case 'caption':
        return fuegoColors.text.dimmed;
      case 'code':
        return fuegoColors.accent.cyan;
      default:
        return fuegoColors.text.secondary;
    }
  };

  const getTypographyProps = () => {
    const baseProps = {
      color: getTypographyColor(),
      bold: bold || (variant === 'h1' || variant === 'h2'),
      dimColor: dimColor
    };

    return baseProps;
  };

  return (
    <Text {...getTypographyProps()}>
      {children}
    </Text>
  );
};

// Professional Card Component with Graphyn styling
interface CardProps {
  title?: string;
  borderColor?: string;
  children: React.ReactNode;
  padding?: number;
  margin?: number;
  variant?: 'default' | 'accent' | 'warning' | 'error' | 'success';
}

export const Card: React.FC<CardProps> = ({
  title,
  borderColor,
  children,
  padding = 2,
  margin = 1,
  variant = 'default'
}) => {
  const getBorderColor = () => {
    if (borderColor) return borderColor;
    
    switch (variant) {
      case 'accent':
        return fuegoColors.border.accent;
      case 'warning':
        return colors.warning;
      case 'error':
        return colors.error;
      case 'success':
        return colors.success;
      default:
        return fuegoColors.border.subtle;
    }
  };

  return (
    <Box
      borderStyle="round"
      borderColor={getBorderColor()}
      paddingX={padding}
      paddingY={1}
      marginBottom={margin}
      flexDirection="column"
    >
      {title && (
        <Box borderBottom marginBottom={1} paddingBottom={1}>
          <Typography variant="h3" bold>
            {title}
          </Typography>
        </Box>
      )}
      {children}
    </Box>
  );
};

// Professional Badge Component
interface BadgeProps {
  variant: 'pending' | 'active' | 'completed' | 'error' | 'warning' | 'info';
  children: React.ReactNode;
  icon?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant, children, icon }) => {
  const getBadgeColor = () => {
    switch (variant) {
      case 'pending':
        return fuegoColors.text.dimmed;
      case 'active':
        return colors.info;
      case 'completed':
        return colors.success;
      case 'error':
        return colors.error;
      case 'warning':
        return colors.warning;
      case 'info':
        return colors.info;
      default:
        return fuegoColors.text.secondary;
    }
  };

  const getBadgeIcon = () => {
    if (icon) return icon;
    
    switch (variant) {
      case 'pending':
        return '⏳';
      case 'active':
        return '⚡';
      case 'completed':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return '💡';
      default:
        return '•';
    }
  };

  return (
    <Box flexDirection="row" alignItems="center" gap={1}>
      <Text color={getBadgeColor()}>
        {getBadgeIcon()}
      </Text>
      <Text color={getBadgeColor()}>
        {children}
      </Text>
    </Box>
  );
};

// Professional Divider Component
interface DividerProps {
  label?: string;
  color?: string;
}

export const Divider: React.FC<DividerProps> = ({ 
  label, 
  color = fuegoColors.border.subtle 
}) => {
  if (label) {
    return (
      <Box justifyContent="center" marginY={1}>
        <Box flexDirection="row" alignItems="center" gap={2}>
          <Text color={color}>━━━━━━</Text>
          <Typography variant="caption" color={color}>
            {label}
          </Typography>
          <Text color={color}>━━━━━━</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box borderBottom borderColor={color} marginY={1} />
  );
};

// Professional Loading Indicator
interface LoadingIndicatorProps {
  message?: string;
  variant?: 'dots' | 'spinner' | 'progress';
  progress?: number;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  message = 'Loading...',
  variant = 'dots',
  progress
}) => {
  const renderIndicator = () => {
    switch (variant) {
      case 'progress':
        if (progress !== undefined) {
          const width = 20;
          const filled = Math.floor(progress * width / 100);
          const empty = width - filled;
          
          return (
            <Box flexDirection="row" alignItems="center" gap={2}>
              <Box flexDirection="row">
                <Text color={colors.info}>{'█'.repeat(filled)}</Text>
                <Text color={fuegoColors.text.dimmed}>{'░'.repeat(empty)}</Text>
              </Box>
              <Typography variant="caption">
                {Math.round(progress)}%
              </Typography>
            </Box>
          );
        }
        return null;
      case 'spinner':
        return <Text color={colors.info}>⟳</Text>;
      case 'dots':
      default:
        return <Text color={colors.info}>⋯</Text>;
    }
  };

  return (
    <Box flexDirection="row" alignItems="center" gap={2}>
      {renderIndicator()}
      <Typography variant="body" color={colors.info}>
        {message}
      </Typography>
    </Box>
  );
};

// Professional Key Hint Component
interface KeyHintProps {
  keys: Array<{
    key: string;
    description: string;
  }>;
  compact?: boolean;
}

export const KeyHints: React.FC<KeyHintProps> = ({ keys, compact = false }) => {
  return (
    <Box flexDirection="row" gap={compact ? 1 : 2}>
      {keys.map((hint, index) => (
        <Box key={hint.key} flexDirection="row" alignItems="center">
          {index > 0 && !compact && (
            <Text color={fuegoColors.text.dimmed}> | </Text>
          )}
          <Text color={fuegoColors.accent.cyan} bold>
            {hint.key}
          </Text>
          <Typography variant="caption">
            : {hint.description}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

// Professional Alert Component
interface AlertProps {
  type: 'info' | 'warning' | 'error' | 'success';
  title?: string;
  children: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
}

export const Alert: React.FC<AlertProps> = ({
  type,
  title,
  children,
  dismissible = false,
  onDismiss
}) => {
  const getAlertConfig = () => {
    switch (type) {
      case 'error':
        return { icon: '🚨', color: colors.error, borderColor: colors.error };
      case 'warning':
        return { icon: '⚠️', color: colors.warning, borderColor: colors.warning };
      case 'success':
        return { icon: '✅', color: colors.success, borderColor: colors.success };
      case 'info':
      default:
        return { icon: '💡', color: colors.info, borderColor: colors.info };
    }
  };

  const { icon, color, borderColor } = getAlertConfig();

  return (
    <Card borderColor={borderColor} variant={type === 'info' ? 'accent' : type}>
      <Box flexDirection="column">
        <Box flexDirection="row" alignItems="center" justifyContent="space-between">
          <Box flexDirection="row" alignItems="center" gap={1}>
            <Text color={color}>{icon}</Text>
            {title && (
              <Typography variant="h3" color={color} bold>
                {title}
              </Typography>
            )}
          </Box>
          
          {dismissible && onDismiss && (
            <Text color={fuegoColors.text.dimmed}>
              ✕
            </Text>
          )}
        </Box>
        
        <Box marginTop={title ? 1 : 0} marginLeft={2}>
          <Typography variant="body">
            {children}
          </Typography>
        </Box>
      </Box>
    </Card>
  );
};

// Export all design system components
export const GraphynDesignSystem = {
  Typography,
  Card,
  Badge,
  Divider,
  LoadingIndicator,
  KeyHints,
  Alert
};

// Theme constants for consistent spacing and layout
export const spacing = {
  xs: 1,
  sm: 2,
  md: 3,
  lg: 4,
  xl: 5
};

export const layout = {
  maxWidth: 120,
  sidebarWidth: 40,
  contentWidth: 80,
  minHeight: 24
};