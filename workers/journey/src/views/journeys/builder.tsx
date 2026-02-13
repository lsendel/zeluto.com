import type { FC } from 'hono/jsx';

/**
 * Step add form fragment. Returned via HTMX when clicking "+ Action", "+ Condition", etc.
 * This renders inline inside #step-palette and submits the step creation via HTMX.
 */
export interface StepAddFormProps {
  journeyId: string;
  stepType: string;
}

const stepTypeLabels: Record<string, string> = {
  action: 'Action Step',
  condition: 'Condition Step',
  delay: 'Delay Step',
  split: 'Split Step',
  trigger: 'Trigger Step',
};

const actionSubTypes = [
  { value: 'send_email', label: 'Send Email' },
  { value: 'send_sms', label: 'Send SMS' },
  { value: 'add_tag', label: 'Add Tag' },
  { value: 'remove_tag', label: 'Remove Tag' },
  { value: 'update_field', label: 'Update Field' },
  { value: 'webhook', label: 'Call Webhook' },
];

export const StepAddForm: FC<StepAddFormProps> = ({ journeyId, stepType }) => {
  const label = stepTypeLabels[stepType] ?? 'Step';

  return (
    <div class="rounded-lg border border-blue-200 bg-blue-50 p-4 mb-4">
      <h4 class="text-sm font-semibold text-blue-900 mb-3">Add {label}</h4>
      <form
        hx-post={`/api/v1/journey/journeys/${journeyId}/steps`}
        hx-target="#app-content"
        hx-ext="json-enc"
        class="space-y-3"
      >
        <input type="hidden" name="type" value={stepType} />
        <input type="hidden" name="positionX" value="0" />
        <input type="hidden" name="positionY" value="0" />

        {stepType === 'action' && (
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Action Type</label>
            <select
              name="config.action"
              class="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            >
              {actionSubTypes.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {stepType === 'delay' && (
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Duration</label>
              <input
                name="config.duration"
                type="number"
                min="1"
                value="1"
                class="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Unit</label>
              <select
                name="config.unit"
                class="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="minutes">Minutes</option>
                <option value="hours" selected>Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
          </div>
        )}

        {stepType === 'condition' && (
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Condition Expression</label>
            <input
              name="config.expression"
              type="text"
              placeholder="e.g. contact.email_opened == true"
              class="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
        )}

        {stepType === 'split' && (
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Split Type</label>
            <select
              name="config.splitType"
              class="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="random">Random (A/B)</option>
              <option value="percentage">By Percentage</option>
            </select>
          </div>
        )}

        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">Label (optional)</label>
          <input
            name="config.name"
            type="text"
            placeholder="Step name"
            class="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div class="flex gap-2">
          <button
            type="submit"
            class="inline-flex items-center rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            Add Step
          </button>
          <button
            type="button"
            hx-get={`/app/journey/journeys/${journeyId}?tab=builder`}
            hx-target="#app-content"
            class="inline-flex items-center rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};
