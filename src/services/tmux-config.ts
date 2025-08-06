export const TMUX_CONFIG_COMMANDS = [
  // Enable mouse support
  '-g mouse on',
  
  // Increase scrollback buffer
  '-g history-limit 50000',
  
  // Don't rename windows automatically
  '-g allow-rename off',
  
  // Fix escape delay
  '-sg escape-time 0',
  
  // Better colors
  '-g default-terminal "screen-256color"',
  
  // Set status bar with exit instructions
  '-g status-style "bg=black,fg=white"',
  '-g status-left "[Squad] "',
  '-g status-right "Exit: Ctrl+B d | Zoom: Ctrl+B z"'
];

export const TMUX_WINDOW_COMMANDS = [
  // Use vi mode for copy
  '-g mode-keys vi'
];

export const TMUX_KEY_BINDINGS = [
  // Add Ctrl+Q as an alias for detach
  'bind-key C-q detach-client',
  
  // Add Alt+Q as another detach option
  'bind-key -n M-q detach-client',
  
  // Override q in copy mode to prevent accidental exit
  'bind-key -T copy-mode-vi q send-keys -X cancel'
];

export const createTmuxConfig = (sessionName: string): string => {
  const setCommands = TMUX_CONFIG_COMMANDS.map(cmd => 
    `tmux set-option -t ${sessionName} ${cmd}`
  ).join(' && ');
  
  const windowCommands = TMUX_WINDOW_COMMANDS.map(cmd => 
    `tmux set-window-option -t ${sessionName} ${cmd}`
  ).join(' && ');
  
  const keyBindings = TMUX_KEY_BINDINGS.map(cmd =>
    `tmux ${cmd} -t ${sessionName}`
  ).join(' && ');
  
  return `${setCommands} && ${windowCommands} && ${keyBindings}`;
};