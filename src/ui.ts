import chalk from 'chalk';
import gradient from 'gradient-string';
import figlet from 'figlet';
import boxen from 'boxen';

type GradientFunction = typeof gradient.rainbow;
type ChalkInstance = typeof chalk;

// Enhanced color palette
export const colors = {
  primary: chalk.hex('#3267F5'),
  secondary: chalk.hex('#C0B7FD'),
  accent: chalk.hex('#A67763'),
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.gray,
  highlight: chalk.cyan,
  dim: chalk.dim,
  bold: chalk.bold
};

// Gradient themes
export const gradients: Record<string, GradientFunction> = {
  brand: gradient(['#3267F5', '#C0B7FD']),
  success: gradient(['#00C851', '#00FF00']),
  error: gradient(['#FF4444', '#CC0000']),
  rainbow: gradient.rainbow
};

// Agent themes
export const agentThemes: Record<string, { icon: string; color: ChalkInstance; gradient: GradientFunction }> = {
  backend: {
    icon: '⚙️',
    color: colors.primary,
    gradient: gradient(['#3267F5', '#1E88E5'])
  },
  frontend: {
    icon: '🎨',
    color: colors.secondary,
    gradient: gradient(['#C0B7FD', '#9C27B0'])
  },
  architect: {
    icon: '🏗️',
    color: colors.accent,
    gradient: gradient(['#A67763', '#FF6F00'])
  }
};

// Create stylized banner
export async function createBanner(): Promise<string> {
  return new Promise((resolve) => {
    figlet.text('Graphyn', {
      font: 'ANSI Shadow',
      horizontalLayout: 'default',
      verticalLayout: 'default'
    }, (err, data) => {
      if (err || !data) {
        resolve(createFallbackBanner());
        return;
      }
      
      const gradientBanner = gradients.brand(data);
      const subtitle = colors.dim('AI Development Agents for Claude Code');
      const boxedBanner = boxen(`${gradientBanner}\n\n${subtitle}`, {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'blue',
        align: 'center'
      });
      
      resolve(boxedBanner);
    });
  });
}

// Fallback banner if figlet fails
function createFallbackBanner(): string {
  const title = gradients.brand('═══ GRAPHYN CODE ═══');
  const subtitle = colors.dim('AI Development Agents for Claude Code');
  
  return boxen(`${title}\n${subtitle}`, {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'blue',
    align: 'center'
  });
}

// Create agent header
export function createAgentHeader(type: string, mode: string = ''): string {
  const theme = agentThemes[type as keyof typeof agentThemes];
  if (!theme) return '';
  
  const title = `${theme.icon} ${type.charAt(0).toUpperCase() + type.slice(1)} Agent`;
  const modeText = mode ? colors.dim(` - ${mode}`) : '';
  
  const header = theme.gradient(title) + modeText;
  
  return boxen(header, {
    padding: { top: 0, bottom: 0, left: 2, right: 2 },
    borderStyle: 'round',
    borderColor: 'cyan',
    align: 'center'
  });
}

// Create status box
export function createStatusBox(title: string, items: string[]): string {
  const content = items.join('\n');
  
  return boxen(content, {
    title: colors.bold(title),
    titleAlignment: 'center',
    padding: 1,
    borderStyle: 'round',
    borderColor: 'green'
  });
}

// Create error box
export function createErrorBox(error: string): string {
  return boxen(colors.error(error), {
    title: colors.error.bold('❌ Error'),
    titleAlignment: 'center',
    padding: 1,
    borderStyle: 'round',
    borderColor: 'red'
  });
}

// Create success box
export function createSuccessBox(message: string): string {
  return boxen(colors.success(message), {
    title: colors.success.bold('✅ Success'),
    titleAlignment: 'center',
    padding: 1,
    borderStyle: 'round',
    borderColor: 'green'
  });
}

// Format list items
export function formatList(items: string[], bullet: string = '•'): string {
  return items.map(item => `  ${colors.accent(bullet)} ${item}`).join('\n');
}

// Create progress steps
export function createProgressSteps(steps: { name: string; status: 'pending' | 'active' | 'done' | 'error' }[]): string {
  return steps.map((step) => {
    let icon = '○';
    let color = colors.dim;
    
    switch (step.status) {
      case 'active':
        icon = '◉';
        color = colors.highlight;
        break;
      case 'done':
        icon = '●';
        color = colors.success;
        break;
      case 'error':
        icon = '✗';
        color = colors.error;
        break;
    }
    
    return `  ${color(icon)} ${color(step.name)}`;
  }).join('\n');
}

// Create a divider
export function createDivider(char: string = '─', length: number = 60): string {
  return colors.dim(char.repeat(length));
}

// Format command examples
export function formatCommand(command: string, description?: string): string {
  const cmd = colors.highlight(`$ ${command}`);
  const desc = description ? colors.dim(` # ${description}`) : '';
  return `  ${cmd}${desc}`;
}

// Create tip box
export function createTipBox(tip: string): string {
  return boxen(`${colors.accent('💡')} ${tip}`, {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    borderStyle: 'round',
    borderColor: 'yellow'
  });
}