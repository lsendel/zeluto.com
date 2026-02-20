import type { Child, FC } from '../types.js';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  class?: string;
  children: Child;
  onclick?: string;
  /** HTMX: URL to GET */
  'hx-get'?: string;
  /** HTMX: URL to POST */
  'hx-post'?: string;
  /** HTMX: URL to PUT */
  'hx-put'?: string;
  /** HTMX: URL to DELETE */
  'hx-delete'?: string;
  /** HTMX: target element selector */
  'hx-target'?: string;
  /** HTMX: swap strategy */
  'hx-swap'?: string;
  /** HTMX: trigger event */
  'hx-trigger'?: string;
  /** HTMX: confirmation prompt */
  'hx-confirm'?: string;
  /** HTMX: loading indicator */
  'hx-indicator'?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-500 shadow-sm',
  secondary:
    'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-brand-500 shadow-sm',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-sm',
  ghost:
    'text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:ring-brand-500',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export const Button: FC<ButtonProps> = (props) => {
  const {
    variant = 'primary',
    size = 'md',
    type = 'button',
    disabled = false,
    class: className = '',
    children,
    ...htmxAttrs
  } = props;

  const classes = [
    'inline-flex items-center justify-center font-medium rounded-lg',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
    'transition-colors duration-150',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    variantClasses[variant],
    sizeClasses[size],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} disabled={disabled} class={classes} {...htmxAttrs}>
      {children}
    </button>
  );
};
