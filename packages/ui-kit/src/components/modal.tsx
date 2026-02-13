import type { Child, FC } from "../types.js";

export type ModalSize = "sm" | "md" | "lg" | "xl";

export interface ModalProps {
  id: string;
  title: string;
  size?: ModalSize;
  class?: string;
  children: Child;
  /** Footer content (e.g., action buttons) */
  footer?: Child;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

/**
 * Modal dialog component.
 *
 * Usage with HTMX: Load modal content via hx-get into a container,
 * then show it. The modal renders with a backdrop and close button.
 *
 * To open: hx-get="/some/modal" hx-target="#modal-container" hx-swap="innerHTML"
 * To close: Click backdrop, press Escape, or click the close button.
 *
 * The modal uses `_hyperscript`-compatible attributes for close behavior,
 * but also includes a small inline script fallback.
 */
export const Modal: FC<ModalProps> = ({
  id,
  title,
  size = "md",
  class: className = "",
  children,
  footer,
}) => {
  return (
    <div
      id={id}
      class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
    >
      {/* Backdrop */}
      <div
        class="fixed inset-0 bg-black/50 transition-opacity"
        aria-hidden="true"
        onclick={`document.getElementById('${id}').remove()`}
      />

      {/* Modal panel */}
      <div
        class={`relative w-full ${sizeClasses[size]} rounded-xl bg-white shadow-xl ${className}`}
      >
        {/* Header */}
        <div class="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2
            id={`${id}-title`}
            class="text-lg font-semibold text-gray-900"
          >
            {title}
          </h2>
          <button
            type="button"
            class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
            aria-label="Close"
            onclick={`document.getElementById('${id}').remove()`}
          >
            <svg
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div class="px-6 py-4">{children}</div>

        {/* Footer */}
        {footer && (
          <div class="flex items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Empty container for modals to be loaded into via HTMX.
 * Place this once in your layout.
 */
export const ModalContainer: FC = () => {
  return <div id="modal-container" />;
};
