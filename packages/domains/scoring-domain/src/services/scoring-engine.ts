import type { ScoringModel, ContactFeatures, ScoringResult } from './scoring-model.js';
import type { LeadScoreRepository } from '../repositories/lead-score-repository.js';
import type { IntentSignalRepository } from '../repositories/intent-signal-repository.js';
import type { ScoringConfigRepository } from '../repositories/scoring-config-repository.js';
import type { ScoreHistoryRepository } from '../repositories/score-history-repository.js';
import { LeadScore } from '../entities/lead-score.js';
import { ScoreHistory } from '../entities/score-history.js';

export interface ScoringEngineOptions {
  scoringModel: ScoringModel;
  leadScoreRepo: LeadScoreRepository;
  intentSignalRepo: IntentSignalRepository;
  scoringConfigRepo: ScoringConfigRepository;
  scoreHistoryRepo: ScoreHistoryRepository;
}

export class ScoringEngine {
  constructor(private readonly options: ScoringEngineOptions) {}

  async scoreContact(orgId: string, contactId: string, features: ContactFeatures): Promise<{
    result: ScoringResult;
    previousScore: number | null;
    thresholdsCrossed: Array<{ threshold: number; direction: 'up' | 'down' }>;
  }> {
    const configs = await this.options.scoringConfigRepo.findByOrganization(orgId);

    // Add intent signal weight to features
    const signals = await this.options.intentSignalRepo.findActiveByContact(orgId, contactId);
    const intentWeight = signals.reduce((sum, s) => sum + s.currentWeight(), 0);
    const adjustedFeatures: ContactFeatures = {
      ...features,
      customFactors: {
        ...features.customFactors,
        ...(intentWeight > 0 ? { intent_signals: intentWeight } : {}),
      },
    };

    const result = this.options.scoringModel.score(adjustedFeatures, configs);

    // Get previous score
    const existing = await this.options.leadScoreRepo.findByContact(orgId, contactId);
    const previousScore = existing?.totalScore ?? null;

    // Save or update lead score
    if (existing) {
      existing.updateScore({
        totalScore: result.totalScore,
        engagementScore: result.engagementScore,
        fitScore: result.fitScore,
        intentScore: result.intentScore,
        components: result.components,
        topContributors: result.topContributors,
      });
      await this.options.leadScoreRepo.save(existing);
    } else {
      const leadScore = LeadScore.create({
        id: crypto.randomUUID(),
        organizationId: orgId,
        contactId,
        totalScore: result.totalScore,
        engagementScore: result.engagementScore,
        fitScore: result.fitScore,
        intentScore: result.intentScore,
        components: result.components,
        topContributors: result.topContributors,
      });
      await this.options.leadScoreRepo.save(leadScore);
    }

    // Check threshold crossings
    const thresholds = [20, 40, 60, 80];
    const thresholdsCrossed: Array<{ threshold: number; direction: 'up' | 'down' }> = [];
    if (previousScore !== null) {
      for (const t of thresholds) {
        if (previousScore < t && result.totalScore >= t) {
          thresholdsCrossed.push({ threshold: t, direction: 'up' });
        } else if (previousScore >= t && result.totalScore < t) {
          thresholdsCrossed.push({ threshold: t, direction: 'down' });
        }
      }
    }

    return { result, previousScore, thresholdsCrossed };
  }

  async recordHistorySnapshot(orgId: string, contactId: string): Promise<void> {
    const score = await this.options.leadScoreRepo.findByContact(orgId, contactId);
    if (!score) return;

    const today = new Date().toISOString().split('T')[0];
    const entry = ScoreHistory.create({
      id: crypto.randomUUID(),
      organizationId: orgId,
      contactId,
      date: today,
      totalScore: score.totalScore,
      engagementScore: score.engagementScore,
      fitScore: score.fitScore,
      intentScore: score.intentScore,
    });
    await this.options.scoreHistoryRepo.save(entry);
  }
}
