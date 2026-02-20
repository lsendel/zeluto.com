import type { Child, FC } from '../types.js';

export interface CardProps {
  title?: string;
  subtitle?: string;
  class?: string;
  children: Child;
  /** Optional footer content */
  footer?: Child;
  /** Remove default padding */
  noPadding?: boolean;
}

export const Card: FC<CardProps> = ({
  title,
  subtitle,
  class: className = '',
  children,
  footer,
  noPadding = false,
}) => {
  return (
    <div
      class={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm ${className}`}
    >
      {(title || subtitle) && (
        <div class="border-b border-gray-200 px-6 py-4">
          {title && (
            <h3 class="text-base font-semibold text-gray-900">{title}</h3>
          )}
          {subtitle && <p class="mt-1 text-sm text-gray-500">{subtitle}</p>}
        </div>
      )}
      <div class={noPadding ? '' : 'px-6 py-4'}>{children}</div>
      {footer && (
        <div class="border-t border-gray-200 bg-gray-50 px-6 py-3">
          {footer}
        </div>
      )}
    </div>
  );
};
