import type { Child, FC } from "../types.js";

export type AlertVariant = "info" | "success" | "warning" | "error";

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  class?: string;
  children: Child;
  /** Allow dismissing the alert */
  dismissible?: boolean;
  /** HTMX: auto-remove after showing (e.g., for toast-like behavior) */
  autoRemoveMs?: number;
}

const variantStyles: Record<
  AlertVariant,
  { container: string; icon: string; title: string }
> = {
  info: {
    container: "bg-blue-50 border-blue-200 text-blue-800",
    icon: "text-blue-500",
    title: "text-blue-800",
  },
  success: {
    container: "bg-green-50 border-green-200 text-green-800",
    icon: "text-green-500",
    title: "text-green-800",
  },
  warning: {
    container: "bg-yellow-50 border-yellow-200 text-yellow-800",
    icon: "text-yellow-500",
    title: "text-yellow-800",
  },
  error: {
    container: "bg-red-50 border-red-200 text-red-800",
    icon: "text-red-500",
    title: "text-red-800",
  },
};

const variantIcons: Record<AlertVariant, string> = {
  info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  success: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  warning:
    "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z",
  error: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
};

export const Alert: FC<AlertProps> = ({
  variant = "info",
  title,
  class: className = "",
  children,
  dismissible = false,
  autoRemoveMs,
}) => {
  const styles = variantStyles[variant];
  const iconPath = variantIcons[variant];

  return (
    <div
      class={`rounded-lg border p-4 ${styles.container} ${className}`}
      role="alert"
      {...(autoRemoveMs
        ? {
            "hx-get": "/api/empty",
            "hx-trigger": `load delay:${autoRemoveMs}ms`,
            "hx-swap": "outerHTML",
          }
        : {})}
    >
      <div class="flex">
        <div class="flex-shrink-0">
          <svg
            class={`h-5 w-5 ${styles.icon}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d={iconPath}
            />
          </svg>
        </div>
        <div class="ml-3 flex-1">
          {title && (
            <h4 class={`text-sm font-semibold ${styles.title}`}>{title}</h4>
          )}
          <div class={`text-sm ${title ? "mt-1" : ""}`}>{children}</div>
        </div>
        {dismissible && (
          <button
            type="button"
            class="ml-auto -mr-1 -mt-1 inline-flex rounded-lg p-1.5 hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-offset-0"
            aria-label="Dismiss"
            onclick="this.closest('[role=alert]').remove()"
          >
            <svg
              class="h-4 w-4"
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
        )}
      </div>
    </div>
  );
};
