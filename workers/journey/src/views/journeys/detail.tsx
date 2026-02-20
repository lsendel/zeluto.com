import type { FC } from 'hono/jsx';
import type { JourneyRow } from '../../infrastructure/repositories/journey-repository.js';
import type {
  ConnectionRow,
  StepRow,
} from '../../infrastructure/repositories/step-repository.js';
import type { TriggerRow } from '../../infrastructure/repositories/trigger-repository.js';
import type { VersionRow } from '../../infrastructure/repositories/version-repository.js';

export interface JourneyDetailProps {
  journey: JourneyRow;
  latestVersion: VersionRow | null;
  steps: StepRow[];
  connections: ConnectionRow[];
  triggers: TriggerRow[];
  activeTab?: 'overview' | 'builder' | 'executions';
}

const statusBadge: Record<string, { bg: string; text: string; label: string }> =
  {
    draft: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' },
    active: { bg: 'bg-green-100', text: 'text-green-700', label: 'Active' },
    paused: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Paused' },
    archived: { bg: 'bg-red-100', text: 'text-red-700', label: 'Archived' },
  };

const stepTypeIcons: Record<string, string> = {
  trigger: 'T',
  action: 'A',
  condition: 'C',
  delay: 'D',
  split: 'S',
};

const stepTypeColors: Record<string, string> = {
  trigger: 'bg-blue-100 text-blue-700 border-blue-200',
  action: 'bg-green-100 text-green-700 border-green-200',
  condition: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  delay: 'bg-purple-100 text-purple-700 border-purple-200',
  split: 'bg-orange-100 text-orange-700 border-orange-200',
};

function formatDate(d: Date | string | null): string {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const OverviewTab: FC<{
  journey: JourneyRow;
  latestVersion: VersionRow | null;
  triggers: TriggerRow[];
  steps: StepRow[];
}> = ({ journey, latestVersion, triggers, steps }) => {
  return (
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Journey info */}
      <div class="rounded-lg border border-gray-200 bg-white p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">
          Journey Information
        </h3>
        <dl class="space-y-3">
          <div class="flex justify-between">
            <dt class="text-sm text-gray-500">Name</dt>
            <dd class="text-sm text-gray-900">{journey.name}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-sm text-gray-500">Description</dt>
            <dd class="text-sm text-gray-900">{journey.description || '-'}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-sm text-gray-500">Created</dt>
            <dd class="text-sm text-gray-900">
              {formatDate(journey.created_at)}
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-sm text-gray-500">Updated</dt>
            <dd class="text-sm text-gray-900">
              {formatDate(journey.updated_at)}
            </dd>
          </div>
          {latestVersion && (
            <div class="flex justify-between">
              <dt class="text-sm text-gray-500">Latest Version</dt>
              <dd class="text-sm text-gray-900">
                v{latestVersion.version_number}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Triggers */}
      <div class="rounded-lg border border-gray-200 bg-white p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">
          Triggers ({triggers.length})
        </h3>
        {triggers.length === 0 ? (
          <p class="text-sm text-gray-500">No triggers configured</p>
        ) : (
          <ul class="space-y-2">
            {triggers.map((t) => (
              <li
                key={t.id}
                class="flex items-center justify-between rounded border border-gray-100 px-3 py-2"
              >
                <span class="text-sm capitalize text-gray-700">{t.type}</span>
                <button
                  hx-delete={`/api/v1/journey/triggers/${t.id}`}
                  hx-target="#app-content"
                  hx-confirm="Remove this trigger?"
                  class="text-xs text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Steps summary */}
      <div class="rounded-lg border border-gray-200 bg-white p-6 lg:col-span-2">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">
          Steps ({steps.length})
        </h3>
        {steps.length === 0 ? (
          <p class="text-sm text-gray-500">
            No steps configured. Open the builder to add steps.
          </p>
        ) : (
          <div class="flex flex-wrap gap-2">
            {steps.map((s) => {
              const colors =
                stepTypeColors[s.type] ??
                'bg-gray-100 text-gray-700 border-gray-200';
              return (
                <div
                  key={s.id}
                  class={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${colors}`}
                >
                  <span class="font-bold">{stepTypeIcons[s.type] ?? '?'}</span>
                  <span class="capitalize">{s.type}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const BuilderTab: FC<{
  journey: JourneyRow;
  steps: StepRow[];
  connections: ConnectionRow[];
  latestVersion: VersionRow | null;
}> = ({ journey, steps, connections, latestVersion }) => {
  return (
    <div class="space-y-6">
      {/* Visual flow display */}
      <div class="rounded-lg border border-gray-200 bg-white p-6 min-h-[400px]">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-sm font-semibold text-gray-900">Flow Builder</h3>
          {journey.status === 'draft' && latestVersion && (
            <div class="flex gap-2">
              <button
                hx-get={`/app/journey/journeys/${journey.id}/add-step?type=action`}
                hx-target="#step-palette"
                hx-swap="innerHTML"
                class="inline-flex items-center rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                + Action
              </button>
              <button
                hx-get={`/app/journey/journeys/${journey.id}/add-step?type=condition`}
                hx-target="#step-palette"
                hx-swap="innerHTML"
                class="inline-flex items-center rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                + Condition
              </button>
              <button
                hx-get={`/app/journey/journeys/${journey.id}/add-step?type=delay`}
                hx-target="#step-palette"
                hx-swap="innerHTML"
                class="inline-flex items-center rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                + Delay
              </button>
              <button
                hx-get={`/app/journey/journeys/${journey.id}/add-step?type=split`}
                hx-target="#step-palette"
                hx-swap="innerHTML"
                class="inline-flex items-center rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                + Split
              </button>
            </div>
          )}
        </div>

        <div id="step-palette" class="mb-4"></div>

        {/* Step list with visual connections */}
        <div class="space-y-3">
          {steps.length === 0 ? (
            <div class="flex flex-col items-center justify-center py-16 text-gray-400">
              <p class="text-sm">No steps yet.</p>
              <p class="text-xs mt-1">Add steps to build your journey flow.</p>
            </div>
          ) : (
            steps.map((step) => {
              const colors =
                stepTypeColors[step.type] ??
                'bg-gray-100 text-gray-700 border-gray-200';
              const outgoingConnections = connections.filter(
                (conn) => conn.from_step_id === step.id,
              );
              const config = step.config as Record<string, unknown>;

              return (
                <div key={step.id} class="relative">
                  <div class={`rounded-lg border-2 p-4 ${colors}`}>
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <span class="text-lg font-bold">
                          {stepTypeIcons[step.type] ?? '?'}
                        </span>
                        <div>
                          <p class="text-sm font-medium capitalize">
                            {step.type}
                          </p>
                          {config.name && (
                            <p class="text-xs opacity-75">
                              {String(config.name)}
                            </p>
                          )}
                        </div>
                      </div>
                      {journey.status === 'draft' && (
                        <div class="flex gap-1">
                          <button
                            hx-delete={`/api/v1/journey/steps/${step.id}`}
                            hx-target="#app-content"
                            hx-confirm="Delete this step?"
                            class="text-xs opacity-60 hover:opacity-100"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Connections */}
                  {outgoingConnections.length > 0 && (
                    <div class="ml-6 mt-1 mb-1 border-l-2 border-gray-300 pl-4 py-1">
                      {outgoingConnections.map((conn) => (
                        <span key={conn.id} class="text-xs text-gray-400">
                          {conn.label ? `[${conn.label}]` : ''} connects to next
                          step
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

const ExecutionsTab: FC<{ journey: JourneyRow }> = ({ journey }) => {
  return (
    <div
      id="execution-list"
      hx-get={`/api/v1/journey/journeys/${journey.id}/executions`}
      hx-trigger="load"
      hx-swap="innerHTML"
    >
      <div class="flex items-center justify-center py-12">
        <div class="text-sm text-gray-500">Loading executions...</div>
      </div>
    </div>
  );
};

export const JourneyDetailView: FC<JourneyDetailProps> = ({
  journey,
  latestVersion,
  steps,
  connections,
  triggers,
  activeTab = 'overview',
}) => {
  const badge = statusBadge[journey.status] ?? statusBadge.draft;
  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'builder' as const, label: 'Builder' },
    { id: 'executions' as const, label: 'Executions' },
  ];

  return (
    <div id="journey-detail">
      {/* Breadcrumb + Header */}
      <div class="mb-6">
        <div class="flex items-center gap-2 mb-4">
          <a
            href="/app/journey/journeys"
            hx-get="/app/journey/journeys"
            hx-target="#app-content"
            hx-push-url="true"
            class="text-sm text-gray-500 hover:text-gray-700"
          >
            Journeys
          </a>
          <span class="text-gray-400">/</span>
          <span class="text-sm text-gray-900">{journey.name}</span>
        </div>

        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <h1 class="text-2xl font-bold text-gray-900">{journey.name}</h1>
            <span
              class={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}
            >
              {badge.label}
            </span>
          </div>
          <div class="flex items-center gap-2">
            {journey.status === 'draft' && (
              <button
                hx-post={`/api/v1/journey/journeys/${journey.id}/publish`}
                hx-target="#app-content"
                hx-confirm="Publish this journey? This will create a new version and activate it."
                class="inline-flex items-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700"
              >
                Publish
              </button>
            )}
            {journey.status === 'active' && (
              <button
                hx-post={`/api/v1/journey/journeys/${journey.id}/pause`}
                hx-target="#app-content"
                class="inline-flex items-center rounded-lg bg-yellow-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-yellow-600"
              >
                Pause
              </button>
            )}
            {journey.status === 'paused' && (
              <button
                hx-post={`/api/v1/journey/journeys/${journey.id}/resume`}
                hx-target="#app-content"
                class="inline-flex items-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700"
              >
                Resume
              </button>
            )}
            <button
              hx-get={`/app/journey/journeys/${journey.id}/edit`}
              hx-target="#app-content"
              hx-push-url="true"
              class="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Edit
            </button>
            <button
              hx-delete={`/api/v1/journey/journeys/${journey.id}`}
              hx-confirm="Are you sure you want to delete this journey? This action cannot be undone."
              hx-target="#app-content"
              class="inline-flex items-center rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div class="border-b border-gray-200 mb-6">
        <nav class="-mb-px flex gap-6" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              hx-get={`/app/journey/journeys/${journey.id}?tab=${tab.id}`}
              hx-target="#app-content"
              hx-push-url="true"
              class={`whitespace-nowrap border-b-2 py-3 text-sm font-medium transition-colors ${
                tab.id === activeTab
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div id="tab-content">
        {activeTab === 'overview' && (
          <OverviewTab
            journey={journey}
            latestVersion={latestVersion}
            triggers={triggers}
            steps={steps}
          />
        )}
        {activeTab === 'builder' && (
          <BuilderTab
            journey={journey}
            steps={steps}
            connections={connections}
            latestVersion={latestVersion}
          />
        )}
        {activeTab === 'executions' && <ExecutionsTab journey={journey} />}
      </div>
    </div>
  );
};
