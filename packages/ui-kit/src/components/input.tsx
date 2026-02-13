import type { FC } from "../types.js";

export interface InputProps {
  name: string;
  label?: string;
  type?: "text" | "email" | "password" | "number" | "tel" | "url" | "search" | "date";
  placeholder?: string;
  value?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  hint?: string;
  class?: string;
  id?: string;
  autocomplete?: string;
  /** HTMX: URL to GET for validation */
  "hx-get"?: string;
  /** HTMX: URL to POST */
  "hx-post"?: string;
  /** HTMX: target element selector */
  "hx-target"?: string;
  /** HTMX: swap strategy */
  "hx-swap"?: string;
  /** HTMX: trigger event */
  "hx-trigger"?: string;
}

export const Input: FC<InputProps> = (props) => {
  const {
    name,
    label,
    type = "text",
    placeholder,
    value,
    required = false,
    disabled = false,
    error,
    hint,
    class: className = "",
    id,
    autocomplete,
    ...htmxAttrs
  } = props;

  const inputId = id ?? `input-${name}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  const inputClasses = [
    "block w-full rounded-lg border px-3 py-2 text-sm",
    "focus:outline-none focus:ring-2 focus:ring-offset-0",
    "disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed",
    "placeholder:text-gray-400",
    error
      ? "border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500"
      : "border-gray-300 text-gray-900 focus:border-brand-500 focus:ring-brand-500",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      {label && (
        <label
          for={inputId}
          class="mb-1 block text-sm font-medium text-gray-700"
        >
          {label}
          {required && <span class="ml-1 text-red-500">*</span>}
        </label>
      )}
      <input
        id={inputId}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        required={required}
        disabled={disabled}
        autocomplete={autocomplete}
        class={inputClasses}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        {...htmxAttrs}
      />
      {error && (
        <p id={errorId} class="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} class="mt-1 text-sm text-gray-500">
          {hint}
        </p>
      )}
    </div>
  );
};
