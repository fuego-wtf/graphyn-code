export const showTmuxTips = () => {
  console.log('\n📌 TMUX Session Controls:');
  console.log('\x1b[1;42m EXIT OPTIONS: \x1b[0m');
  console.log('  • \x1b[1;32mCtrl+B then d\x1b[0m - Return to Squad View (recommended)');
  console.log('  • \x1b[1;32mAlt+Q\x1b[0m - Quick return to Squad View');
  console.log('  • \x1b[1;32mCtrl+B then Ctrl+Q\x1b[0m - Alternative exit\n');
  console.log('\x1b[1;44m NAVIGATION: \x1b[0m');
  console.log('  • Mouse scroll - Scroll with mouse wheel');
  console.log('  • Ctrl+B then [ - Keyboard scroll mode (arrows/PgUp/PgDn, q exits scroll)');
  console.log('  • Ctrl+B then z - Toggle zoom on current pane');
  console.log('  • Ctrl+B then arrows - Switch between panes\n');
  console.log('⚠️  \x1b[1;33mNOTE: The status bar at bottom shows exit keys\x1b[0m\n');
};