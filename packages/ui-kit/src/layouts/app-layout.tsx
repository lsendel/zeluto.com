import type { Child, FC } from "../types.js";
import { SidebarNav } from "../components/nav.js";
import type { NavGroup } from "../components/nav.js";
import { ModalContainer } from "../components/modal.js";
import { resolveAssetUrl } from "../utils/assets.js";

export interface AppLayoutProps {
  /** Page title for the <title> tag */
  title?: string;
  /** Current path to highlight active nav item */
  currentPath?: string;
  /** User display name */
  userName?: string;
  /** User email */
  userEmail?: string;
  /** Current organization name */
  orgName?: string;
  /** Page content */
  children: Child;
  /** Additional head content (meta tags, scripts) */
  head?: Child;
  /** Base URL for static assets (CSS/JS) */
  assetsBaseUrl?: string;
}

/** SVG icon helper — renders a 20x20 outline icon */
const Icon: FC<{ d: string }> = ({ d }) => (
  <svg
    class="h-5 w-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    stroke-width="1.5"
    aria-hidden="true"
  >
    <path stroke-linecap="round" stroke-linejoin="round" d={d} />
  </svg>
);

const navIcons = {
  dashboard:
    "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z",
  contacts:
    "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  journeys:
    "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7",
  campaigns:
    "M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z",
  content:
    "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z",
  delivery:
    "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  analytics:
    "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  settings:
    "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
  settingsInner: "M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  billing:
    "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
};

function buildNavGroups(currentPath?: string): NavGroup[] {
  const isActive = (href: string) =>
    currentPath ? currentPath === href || currentPath.startsWith(href + "/") : false;

  return [
    {
      items: [
        {
          label: "Dashboard",
          href: "/dashboard",
          icon: <Icon d={navIcons.dashboard} />,
          active: isActive("/dashboard"),
        },
      ],
    },
    {
      title: "Audience",
      items: [
        {
          label: "Contacts",
          href: "/contacts",
          icon: <Icon d={navIcons.contacts} />,
          active: isActive("/contacts"),
        },
      ],
    },
    {
      title: "Marketing",
      items: [
        {
          label: "Journeys",
          href: "/journeys",
          icon: <Icon d={navIcons.journeys} />,
          active: isActive("/journeys"),
        },
        {
          label: "Campaigns",
          href: "/campaigns",
          icon: <Icon d={navIcons.campaigns} />,
          active: isActive("/campaigns"),
        },
        {
          label: "Content",
          href: "/content",
          icon: <Icon d={navIcons.content} />,
          active: isActive("/content"),
        },
      ],
    },
    {
      title: "Channels",
      items: [
        {
          label: "Delivery",
          href: "/delivery",
          icon: <Icon d={navIcons.delivery} />,
          active: isActive("/delivery"),
        },
      ],
    },
    {
      title: "Insights",
      items: [
        {
          label: "Analytics",
          href: "/analytics",
          icon: <Icon d={navIcons.analytics} />,
          active: isActive("/analytics"),
        },
      ],
    },
    {
      title: "Account",
      items: [
        {
          label: "Settings",
          href: "/settings",
          icon: <Icon d={navIcons.settings} />,
          active: isActive("/settings"),
        },
        {
          label: "Billing",
          href: "/billing",
          icon: <Icon d={navIcons.billing} />,
          active: isActive("/billing"),
        },
      ],
    },
  ];
}

export const AppLayout: FC<AppLayoutProps> = ({
  title = "Zeluto",
  currentPath,
  userName = "User",
  userEmail,
  orgName = "My Organization",
  children,
  head,
  assetsBaseUrl,
}) => {
  const navGroups = buildNavGroups(currentPath);
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <html lang="en" class="h-full bg-gray-50">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title} | Zeluto</title>
        <link rel="stylesheet" href={resolveAssetUrl(assetsBaseUrl, "/styles/latest.css")} />
        <script src="https://unpkg.com/htmx.org@2.0.4" crossorigin="anonymous" />
        {head}
      </head>
      <body class="h-full" hx-boost="true">
        <div class="flex h-full">
          {/* Sidebar */}
          <aside class="hidden w-64 flex-shrink-0 border-r border-gray-200 bg-white lg:flex lg:flex-col">
            {/* Logo */}
            <div class="flex h-16 items-center gap-2 border-b border-gray-200 px-6">
              <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white font-bold text-sm">
                Z
              </div>
              <span class="text-lg font-bold text-gray-900">Zeluto</span>
            </div>

            {/* Org switcher */}
            <div class="border-b border-gray-200 px-4 py-3">
              <button
                type="button"
                class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
                hx-get="/api/orgs/switcher"
                hx-target="#modal-container"
              >
                <span class="flex h-6 w-6 items-center justify-center rounded bg-brand-100 text-xs font-semibold text-brand-700">
                  {orgName.charAt(0).toUpperCase()}
                </span>
                <span class="flex-1 truncate text-left font-medium">
                  {orgName}
                </span>
                <svg
                  class="h-4 w-4 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M8 9l4-4 4 4m0 6l-4 4-4-4"
                  />
                </svg>
              </button>
            </div>

            {/* Navigation */}
            <div class="flex-1 overflow-y-auto px-3 py-4">
              <SidebarNav groups={navGroups} />
            </div>
          </aside>

          {/* Main content area */}
          <div class="flex flex-1 flex-col overflow-hidden">
            {/* Top bar */}
            <header class="flex h-16 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
              {/* Mobile menu button */}
              <button
                type="button"
                class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 lg:hidden"
                aria-label="Open sidebar"
              >
                <svg
                  class="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>

              <div class="flex-1" />

              {/* User menu */}
              <div class="flex items-center gap-4">
                {/* Notifications */}
                <button
                  type="button"
                  class="relative rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Notifications"
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
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                </button>

                {/* Avatar / user dropdown */}
                <div class="flex items-center gap-3">
                  <div class="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                    {initials}
                  </div>
                  <div class="hidden sm:block">
                    <p class="text-sm font-medium text-gray-900">{userName}</p>
                    {userEmail && (
                      <p class="text-xs text-gray-500">{userEmail}</p>
                    )}
                  </div>
                </div>
              </div>
            </header>

            {/* Main content */}
            <main
              id="main-content"
              class="flex-1 overflow-y-auto p-6"
            >
              {children}
            </main>
          </div>
        </div>

        {/* Modal container for HTMX-loaded modals */}
        <ModalContainer />

        {/* Toast container for alerts */}
        <div
          id="toast-container"
          class="fixed right-4 top-4 z-50 flex flex-col gap-2"
          aria-live="polite"
        />
      </body>
    </html>
  );
};
