import type { Child, FC } from "../types.js";

export interface AuthLayoutProps {
  /** Page title */
  title?: string;
  /** Heading shown above the card */
  heading?: string;
  /** Subheading text */
  subheading?: string;
  /** Page content (form etc.) */
  children: Child;
  /** Additional head content */
  head?: Child;
  /** Footer content below the card (e.g., links to other auth pages) */
  footer?: Child;
}

export const AuthLayout: FC<AuthLayoutProps> = ({
  title = "Sign In",
  heading = "Welcome back",
  subheading = "Sign in to your account to continue",
  children,
  head,
  footer,
}) => {
  return (
    <html lang="en" class="h-full bg-gray-50">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title} | Mauntic</title>
        <link rel="stylesheet" href="/styles/tailwind.css" />
        <script src="https://unpkg.com/htmx.org@2.0.4" crossorigin="anonymous" />
        {head}
      </head>
      <body class="h-full">
        <div class="flex min-h-full flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
          {/* Logo */}
          <div class="mb-8 flex items-center gap-2">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white font-bold text-lg">
              M
            </div>
            <span class="text-2xl font-bold text-gray-900">Mauntic</span>
          </div>

          {/* Card */}
          <div class="w-full max-w-md">
            <div class="rounded-xl border border-gray-200 bg-white px-8 py-10 shadow-sm">
              {/* Heading */}
              <div class="mb-8 text-center">
                <h1 class="text-2xl font-bold tracking-tight text-gray-900">
                  {heading}
                </h1>
                {subheading && (
                  <p class="mt-2 text-sm text-gray-600">{subheading}</p>
                )}
              </div>

              {/* Content */}
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div class="mt-6 text-center text-sm text-gray-600">
                {footer}
              </div>
            )}
          </div>
        </div>
      </body>
    </html>
  );
};
