import * as React from 'react';
import { cn } from '../../utils/cn';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
          "disabled:pointer-events-none disabled:opacity-50",
          {
            default: "bg-blue-600 text-white hover:bg-blue-700",
            secondary: "bg-gray-700 text-gray-200 hover:bg-gray-600",
            outline: "border border-gray-600 bg-transparent hover:bg-gray-800",
            ghost: "hover:bg-gray-800",
            destructive: "bg-red-600 text-white hover:bg-red-700",
          }[variant],
          {
            default: "h-10 px-4 py-2",
            sm: "h-8 rounded-md px-3 text-xs",
            lg: "h-11 rounded-md px-8",
            icon: "h-10 w-10",
          }[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };