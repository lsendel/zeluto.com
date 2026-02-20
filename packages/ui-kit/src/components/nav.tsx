import type { Child, FC } from '../types.js';

export interface NavItem {
  label: string;
  href: string;
  icon?: Child;
  /** Whether this item is currently active */
  active?: boolean;
  /** Badge count to show */
  badge?: number;
}

export interface NavGroup {
  title?: string;
  items: NavItem[];
}

export interface SidebarNavProps {
  groups: NavGroup[];
  class?: string;
}

export const SidebarNav: FC<SidebarNavProps> = ({
  groups,
  class: className = '',
}) => {
  return (
    <nav class={`flex flex-col gap-6 ${className}`} aria-label="Sidebar">
      {groups.map((group, gi) => (
        <div key={gi}>
          {group.title && (
            <h3 class="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              {group.title}
            </h3>
          )}
          <ul class="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  class={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    item.active
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                  aria-current={item.active ? 'page' : undefined}
                >
                  {item.icon && (
                    <span
                      class={`flex-shrink-0 ${
                        item.active
                          ? 'text-brand-600'
                          : 'text-gray-400 group-hover:text-gray-600'
                      }`}
                    >
                      {item.icon}
                    </span>
                  )}
                  <span class="flex-1">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.active
                          ? 'bg-brand-100 text-brand-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
};

/** A single horizontal nav for top bars / tab-like navigation */
export interface TopNavProps {
  items: NavItem[];
  class?: string;
}

export const TopNav: FC<TopNavProps> = ({ items, class: className = '' }) => {
  return (
    <nav class={`flex items-center gap-1 ${className}`}>
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          class={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            item.active
              ? 'bg-gray-100 text-gray-900'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
};
