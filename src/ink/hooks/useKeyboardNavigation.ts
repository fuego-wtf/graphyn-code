import { useInput, Key } from 'ink';
import { useState, useCallback, useEffect } from 'react';

interface UseKeyboardNavigationOptions {
  items: any[];
  onSelect?: (item: any, index: number) => void;
  onCancel?: () => void;
  wrap?: boolean;
  isActive?: boolean;
}

export const useKeyboardNavigation = ({
  items,
  onSelect,
  onCancel,
  wrap = true,
  isActive = true
}: UseKeyboardNavigationOptions) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState(false);

  // Reset selected index when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [items.length]);

  const moveUp = useCallback(() => {
    setSelectedIndex(prev => {
      if (prev === 0) {
        return wrap ? items.length - 1 : 0;
      }
      return prev - 1;
    });
  }, [items.length, wrap]);

  const moveDown = useCallback(() => {
    setSelectedIndex(prev => {
      if (prev === items.length - 1) {
        return wrap ? 0 : prev;
      }
      return prev + 1;
    });
  }, [items.length, wrap]);

  const selectCurrent = useCallback(() => {
    if (items[selectedIndex] && onSelect) {
      onSelect(items[selectedIndex], selectedIndex);
    }
  }, [items, selectedIndex, onSelect]);

  useInput((input, key) => {
    if (!isActive) return;

    // Search mode
    if (searchMode) {
      if (key.escape) {
        setSearchMode(false);
        setSearchQuery('');
      } else if (key.return) {
        // Find first matching item
        const matchIndex = items.findIndex(item => 
          JSON.stringify(item).toLowerCase().includes(searchQuery.toLowerCase())
        );
        if (matchIndex !== -1) {
          setSelectedIndex(matchIndex);
        }
        setSearchMode(false);
        setSearchQuery('');
      } else if (key.backspace || key.delete) {
        setSearchQuery(prev => prev.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta) {
        setSearchQuery(prev => prev + input);
      }
      return;
    }

    // Normal navigation
    if (key.upArrow) {
      moveUp();
    } else if (key.downArrow) {
      moveDown();
    } else if (key.return) {
      selectCurrent();
    } else if (key.escape && onCancel) {
      onCancel();
    } else if (input === '/') {
      setSearchMode(true);
    } else if (input === 'j') {
      moveDown();
    } else if (input === 'k') {
      moveUp();
    } else if (key.pageDown) {
      // Move 5 items down
      setSelectedIndex(prev => 
        Math.min(prev + 5, items.length - 1)
      );
    } else if (key.pageUp) {
      // Move 5 items up
      setSelectedIndex(prev => 
        Math.max(prev - 5, 0)
      );
    } else if ('home' in key && key.home) {
      setSelectedIndex(0);
    } else if ('end' in key && key.end) {
      setSelectedIndex(items.length - 1);
    }
  });

  return {
    selectedIndex,
    setSelectedIndex,
    searchMode,
    searchQuery,
    moveUp,
    moveDown,
    selectCurrent
  };
};

// Hook for handling common keyboard shortcuts
interface UseGlobalKeysOptions {
  onHelp?: () => void;
  onExit?: () => void;
  onBack?: () => void;
  isActive?: boolean;
}

export const useGlobalKeys = ({
  onHelp,
  onExit,
  onBack,
  isActive = true
}: UseGlobalKeysOptions) => {
  const [showHelp, setShowHelp] = useState(false);

  useInput((input, key) => {
    if (!isActive) return;

    if (key.ctrl && input === 'c' && onExit) {
      onExit();
    } else if (key.escape && onBack) {
      onBack();
    } else if (input === '?' && onHelp) {
      onHelp();
      setShowHelp(true);
    } else if (input === 'h' && onHelp) {
      onHelp();
      setShowHelp(true);
    }
  });

  return {
    showHelp,
    setShowHelp
  };
};

// Hook for vim-style navigation
export const useVimNavigation = (
  items: any[],
  onSelect?: (item: any, index: number) => void
) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<'normal' | 'visual'>('normal');

  useInput((input, key) => {
    switch (input) {
      case 'j':
        setSelectedIndex(prev => 
          Math.min(prev + 1, items.length - 1)
        );
        break;
      case 'k':
        setSelectedIndex(prev => 
          Math.max(prev - 1, 0)
        );
        break;
      case 'g':
        setSelectedIndex(0);
        break;
      case 'G':
        setSelectedIndex(items.length - 1);
        break;
      case 'v':
        setMode('visual');
        break;
      case 'i':
      case 'a':
        if (onSelect && items[selectedIndex]) {
          onSelect(items[selectedIndex], selectedIndex);
        }
        break;
    }

    if (key.escape) {
      setMode('normal');
    }
  });

  return {
    selectedIndex,
    mode,
    setSelectedIndex
  };
};