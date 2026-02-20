import { calculateGrade, type Grade } from '../entities/lead-score.js';
import type { ScoringConfigEntry } from '../repositories/scoring-config-repository.js';

export interface ContactFeatures {
  // Demographic
  hasEmail?: boolean;
  hasPhone?: boolean;
  hasDirectPhone?: boolean;
  // Firmographic
  companySize?: 'smb' | 'mid' | 'enterprise';
  seniority?: 'c_level' | 'vp' | 'director' | 'manager' | 'individual';
  // Engagement
  engagementLevel?: 'high' | 'medium' | 'low';
  contentDownloads?: number;
  // Intent
  pricingPageVisit?: boolean;
  demoRequest?: boolean;
  freeTrialSignup?: boolean;
  // Custom
  customFactors?: Record<string, boolean | number>;
}

export interface ScoringResult {
  totalScore: number;
  grade: Grade;
  engagementScore: number;
  fitScore: number;
  intentScore: number;
  components: Record<string, number>;
  topContributors: Array<{ factor: string; points: number }>;
}

export interface ScoringModel {
  score(
    features: ContactFeatures,
    configs?: ScoringConfigEntry[],
  ): ScoringResult;
}

const DEFAULT_WEIGHTS: Record<
  string,
  { points: number; category: 'fit' | 'engagement' | 'intent' }
> = {
  has_email: { points: 10, category: 'fit' },
  has_phone: { points: 15, category: 'fit' },
  has_direct_phone: { points: 10, category: 'fit' },
  company_size_smb: { points: 5, category: 'fit' },
  company_size_mid: { points: 10, category: 'fit' },
  company_size_enterprise: { points: 15, category: 'fit' },
  seniority_c_level: { points: 20, category: 'fit' },
  seniority_vp: { points: 15, category: 'fit' },
  seniority_director: { points: 10, category: 'fit' },
  seniority_manager: { points: 5, category: 'fit' },
  high_engagement: { points: 15, category: 'engagement' },
  medium_engagement: { points: 10, category: 'engagement' },
  content_download: { points: 10, category: 'engagement' },
  pricing_page: { points: 20, category: 'intent' },
  demo_request: { points: 30, category: 'intent' },
  free_trial: { points: 25, category: 'intent' },
};

export class RuleBasedScorer implements ScoringModel {
  score(
    features: ContactFeatures,
    configs?: ScoringConfigEntry[],
  ): ScoringResult {
    const weights = this.buildWeights(configs);
    const components: Record<string, number> = {};
    const contributors: Array<{ factor: string; points: number }> = [];
    let fitScore = 0;
    let engagementScore = 0;
    let intentScore = 0;

    const applyFactor = (factor: string, applies: boolean) => {
      const w = weights[factor];
      if (!w || !applies) return;
      components[factor] = w.points;
      contributors.push({ factor, points: w.points });
      switch (w.category) {
        case 'fit':
          fitScore += w.points;
          break;
        case 'engagement':
          engagementScore += w.points;
          break;
        case 'intent':
          intentScore += w.points;
          break;
      }
    };

    // Demographic / Firmographic
    applyFactor('has_email', !!features.hasEmail);
    applyFactor('has_phone', !!features.hasPhone);
    applyFactor('has_direct_phone', !!features.hasDirectPhone);
    if (features.companySize)
      applyFactor(`company_size_${features.companySize}`, true);
    if (features.seniority)
      applyFactor(`seniority_${features.seniority}`, true);

    // Engagement
    if (features.engagementLevel === 'high')
      applyFactor('high_engagement', true);
    else if (features.engagementLevel === 'medium')
      applyFactor('medium_engagement', true);
    if (features.contentDownloads && features.contentDownloads > 0)
      applyFactor('content_download', true);

    // Intent
    applyFactor('pricing_page', !!features.pricingPageVisit);
    applyFactor('demo_request', !!features.demoRequest);
    applyFactor('free_trial', !!features.freeTrialSignup);

    // Custom factors
    if (features.customFactors) {
      for (const [key, value] of Object.entries(features.customFactors)) {
        const applies = typeof value === 'boolean' ? value : value > 0;
        applyFactor(key, applies);
      }
    }

    const totalScore = Math.min(100, fitScore + engagementScore + intentScore);
    contributors.sort((a, b) => b.points - a.points);

    return {
      totalScore,
      grade: calculateGrade(totalScore),
      engagementScore,
      fitScore,
      intentScore,
      components,
      topContributors: contributors.slice(0, 5),
    };
  }

  private buildWeights(
    configs?: ScoringConfigEntry[],
  ): Record<
    string,
    { points: number; category: 'fit' | 'engagement' | 'intent' }
  > {
    if (!configs || configs.length === 0) return { ...DEFAULT_WEIGHTS };

    const weights = { ...DEFAULT_WEIGHTS };
    for (const config of configs) {
      if (!config.enabled) continue;
      weights[config.factor] = {
        points: config.weight,
        category: config.category as 'fit' | 'engagement' | 'intent',
      };
    }
    return weights;
  }
}
