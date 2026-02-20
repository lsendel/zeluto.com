import { calculateGrade, type Grade } from '../entities/lead-score.js';

export interface ScoreExplanation {
  grade: Grade;
  totalScore: number;
  summary: string;
  factorExplanations: FactorExplanation[];
  categoryBreakdown: CategoryBreakdown;
  trend?: TrendExplanation;
}

export interface FactorExplanation {
  factor: string;
  label: string;
  points: number;
  category: 'fit' | 'engagement' | 'intent';
  impact: 'high' | 'medium' | 'low';
  description: string;
}

export interface CategoryBreakdown {
  fit: { score: number; percentage: number; label: string };
  engagement: { score: number; percentage: number; label: string };
  intent: { score: number; percentage: number; label: string };
}

export interface TrendExplanation {
  direction: 'up' | 'down' | 'stable';
  delta: number;
  description: string;
}

const FACTOR_LABELS: Record<string, { label: string; description: string }> = {
  has_email: {
    label: 'Email available',
    description: 'Contact has a verified email address',
  },
  has_phone: {
    label: 'Phone available',
    description: 'Contact has a phone number on file',
  },
  has_direct_phone: {
    label: 'Direct phone',
    description: 'Direct dial phone number is available',
  },
  company_size_smb: {
    label: 'SMB company',
    description: 'Company is in the small/medium business segment',
  },
  company_size_mid: {
    label: 'Mid-market company',
    description: 'Company is in the mid-market segment',
  },
  company_size_enterprise: {
    label: 'Enterprise company',
    description: 'Company is in the enterprise segment — high fit',
  },
  seniority_c_level: {
    label: 'C-level executive',
    description: 'Contact is a C-level decision maker',
  },
  seniority_vp: {
    label: 'VP-level',
    description: 'Contact is at VP level — strong decision-making authority',
  },
  seniority_director: {
    label: 'Director-level',
    description: 'Contact is at director level',
  },
  seniority_manager: {
    label: 'Manager-level',
    description: 'Contact is at manager level',
  },
  high_engagement: {
    label: 'High engagement',
    description: 'Contact shows high engagement with content and communications',
  },
  medium_engagement: {
    label: 'Medium engagement',
    description: 'Contact shows moderate engagement levels',
  },
  content_download: {
    label: 'Content downloaded',
    description: 'Contact has downloaded gated content',
  },
  pricing_page: {
    label: 'Pricing page visit',
    description:
      'Contact visited the pricing page — strong buying intent signal',
  },
  demo_request: {
    label: 'Demo requested',
    description: 'Contact requested a product demo — highest intent signal',
  },
  free_trial: {
    label: 'Free trial signup',
    description: 'Contact signed up for a free trial — high intent signal',
  },
  intent_signals: {
    label: 'Intent signals detected',
    description: 'Third-party intent data indicates active research',
  },
};

function getFactorLabel(factor: string): { label: string; description: string } {
  return (
    FACTOR_LABELS[factor] ?? {
      label: factor.replace(/_/g, ' '),
      description: `Custom scoring factor: ${factor}`,
    }
  );
}

function categorizeImpact(points: number): 'high' | 'medium' | 'low' {
  if (points >= 20) return 'high';
  if (points >= 10) return 'medium';
  return 'low';
}

function gradeDescription(grade: Grade): string {
  switch (grade) {
    case 'A':
      return 'highly qualified — sales-ready';
    case 'B':
      return 'well qualified — strong prospect';
    case 'C':
      return 'moderately qualified — needs nurturing';
    case 'D':
      return 'early stage — limited qualification';
    case 'F':
      return 'not yet qualified — minimal data or engagement';
  }
}

export class ScoreExplainer {
  explain(input: {
    totalScore: number;
    engagementScore: number;
    fitScore: number;
    intentScore: number;
    components: Record<string, number>;
    topContributors: Array<{ factor: string; points: number }>;
    previousScore?: number | null;
  }): ScoreExplanation {
    const grade = calculateGrade(input.totalScore);

    // Build factor explanations
    const factorExplanations: FactorExplanation[] =
      input.topContributors.map((contributor) => {
        const info = getFactorLabel(contributor.factor);
        const category = this.inferCategory(contributor.factor);
        return {
          factor: contributor.factor,
          label: info.label,
          points: contributor.points,
          category,
          impact: categorizeImpact(contributor.points),
          description: info.description,
        };
      });

    // Category breakdown
    const total = Math.max(1, input.totalScore);
    const categoryBreakdown: CategoryBreakdown = {
      fit: {
        score: input.fitScore,
        percentage: Math.round((input.fitScore / total) * 100),
        label: this.categoryLabel('fit', input.fitScore),
      },
      engagement: {
        score: input.engagementScore,
        percentage: Math.round((input.engagementScore / total) * 100),
        label: this.categoryLabel('engagement', input.engagementScore),
      },
      intent: {
        score: input.intentScore,
        percentage: Math.round((input.intentScore / total) * 100),
        label: this.categoryLabel('intent', input.intentScore),
      },
    };

    // Trend
    let trend: TrendExplanation | undefined;
    if (input.previousScore !== undefined && input.previousScore !== null) {
      const delta = input.totalScore - input.previousScore;
      trend = {
        direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'stable',
        delta,
        description:
          delta > 0
            ? `Score increased by ${delta} points`
            : delta < 0
              ? `Score decreased by ${Math.abs(delta)} points`
              : 'Score unchanged',
      };
    }

    // Summary
    const topFactor = factorExplanations[0];
    const summary = topFactor
      ? `Grade ${grade} (${gradeDescription(grade)}). Top signal: ${topFactor.label} (+${topFactor.points} pts).`
      : `Grade ${grade} (${gradeDescription(grade)}). No scoring factors detected yet.`;

    return {
      grade,
      totalScore: input.totalScore,
      summary,
      factorExplanations,
      categoryBreakdown,
      trend,
    };
  }

  private inferCategory(
    factor: string,
  ): 'fit' | 'engagement' | 'intent' {
    if (
      factor.startsWith('company_size') ||
      factor.startsWith('seniority') ||
      factor.startsWith('has_')
    ) {
      return 'fit';
    }
    if (
      factor.includes('engagement') ||
      factor.includes('content') ||
      factor.includes('download')
    ) {
      return 'engagement';
    }
    if (
      factor.includes('pricing') ||
      factor.includes('demo') ||
      factor.includes('trial') ||
      factor.includes('intent')
    ) {
      return 'intent';
    }
    return 'engagement'; // Default for custom factors
  }

  private categoryLabel(
    category: 'fit' | 'engagement' | 'intent',
    score: number,
  ): string {
    const level = score >= 30 ? 'Strong' : score >= 15 ? 'Moderate' : 'Low';
    switch (category) {
      case 'fit':
        return `${level} demographic/firmographic fit`;
      case 'engagement':
        return `${level} engagement activity`;
      case 'intent':
        return `${level} buying intent`;
    }
  }
}
