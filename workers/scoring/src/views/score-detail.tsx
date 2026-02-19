import type { FC } from 'hono/jsx';

export interface ScoreDetailProps {
  contactId: string;
  totalScore: number;
  grade: string;
  components: Record<string, number>;
  topContributors: Array<{ factor: string; points: number }>;
}

const GradeBadge: FC<{ grade: string }> = ({ grade }) => {
  const colors: Record<string, string> = {
    A: 'bg-green-100 text-green-800',
    B: 'bg-blue-100 text-blue-800',
    C: 'bg-yellow-100 text-yellow-800',
    D: 'bg-orange-100 text-orange-800',
    F: 'bg-red-100 text-red-800',
  };

  return (
    <span
      class={`inline-flex items-center rounded-full px-3 py-1 text-lg font-bold ${colors[grade] ?? 'bg-gray-100 text-gray-800'}`}
    >
      {grade}
    </span>
  );
};

export const ScoreDetailView: FC<ScoreDetailProps> = ({
  contactId,
  totalScore,
  grade,
  components,
  topContributors,
}) => {
  return (
    <div id="score-detail">
      <div class="flex items-center gap-4 mb-6">
        <div>
          <h2 class="text-xl font-bold text-gray-900">Lead Score</h2>
          <p class="text-sm text-gray-500">Contact: {contactId}</p>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-3xl font-bold text-gray-900">{totalScore}</span>
          <GradeBadge grade={grade} />
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div class="rounded-lg border border-gray-200 bg-white p-4">
          <h3 class="text-sm font-semibold text-gray-900 mb-3">Score Components</h3>
          {Object.entries(components).map(([key, value]) => (
            <div class="flex justify-between items-center py-1">
              <span class="text-sm text-gray-600 capitalize">{key.replace(/_/g, ' ')}</span>
              <span class="text-sm font-medium text-gray-900">{value}</span>
            </div>
          ))}
        </div>

        <div class="rounded-lg border border-gray-200 bg-white p-4">
          <h3 class="text-sm font-semibold text-gray-900 mb-3">Top Contributors</h3>
          {topContributors.map((c) => (
            <div class="flex justify-between items-center py-1">
              <span class="text-sm text-gray-600">{c.factor}</span>
              <span class="text-sm font-medium text-green-600">+{c.points}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
