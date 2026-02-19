import type { LLMProvider } from './llm-provider.js';

export type SDRMode = 'autopilot' | 'copilot' | 'learning';

export interface SDRConfig {
  mode: SDRMode;
  minQualificationScore: number;
  minDataCompleteness: number;
  icpCriteria: Record<string, unknown>;
}

export interface QualificationInput {
  contactId: string;
  organizationId: string;
  leadScore: number;
  dataCompleteness: number;
  contactData: Record<string, unknown>;
}

export interface QualificationResult {
  contactId: string;
  qualificationScore: number;
  icpMatch: number;
  reasoning: string;
  recommendation: 'enrich' | 'sequence' | 'skip' | 'manual_review';
  suggestedSequenceId?: string;
}

export interface ResponseAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative';
  intent: 'interested' | 'not_interested' | 'needs_info' | 'objection' | 'meeting_request';
  suggestedAction: string;
}

export class SDRAgent {
  constructor(
    private readonly llm: LLMProvider,
    private readonly config: SDRConfig,
  ) {}

  async qualify(input: QualificationInput): Promise<QualificationResult> {
    // Check data completeness first
    if (input.dataCompleteness < this.config.minDataCompleteness) {
      return {
        contactId: input.contactId,
        qualificationScore: 0,
        icpMatch: 0,
        reasoning: 'Insufficient data for qualification',
        recommendation: 'enrich',
      };
    }

    const prompt = `Qualify this prospect for B2B SaaS sales:
Lead Score: ${input.leadScore}
Data Completeness: ${input.dataCompleteness}
Contact Data: ${JSON.stringify(input.contactData, null, 2)}
ICP Criteria: ${JSON.stringify(this.config.icpCriteria, null, 2)}

Provide: qualification_score (0-100), icp_match (0-1), reasoning, recommendation (enrich/sequence/skip/manual_review)`;

    const response = await this.llm.complete(prompt, {
      temperature: 0.2,
      maxTokens: 512,
      systemPrompt: 'You are an SDR qualification engine. Respond with structured JSON.',
    });

    // Parse LLM response
    try {
      const parsed = JSON.parse(response.content);
      return {
        contactId: input.contactId,
        qualificationScore: parsed.qualification_score ?? input.leadScore,
        icpMatch: parsed.icp_match ?? 0.5,
        reasoning: parsed.reasoning ?? 'AI qualification',
        recommendation: parsed.recommendation ?? 'manual_review',
        suggestedSequenceId: parsed.suggested_sequence_id,
      };
    } catch {
      return {
        contactId: input.contactId,
        qualificationScore: input.leadScore,
        icpMatch: 0.5,
        reasoning: 'Qualification completed with default scoring',
        recommendation: input.leadScore >= this.config.minQualificationScore ? 'sequence' : 'manual_review',
      };
    }
  }

  async analyzeResponse(responseText: string): Promise<ResponseAnalysis> {
    const prompt = `Analyze this sales email response:
"${responseText}"

Determine: sentiment (positive/neutral/negative), intent (interested/not_interested/needs_info/objection/meeting_request), suggested_action`;

    const response = await this.llm.complete(prompt, {
      temperature: 0.1,
      maxTokens: 256,
      systemPrompt: 'You are a sales response analyzer. Respond with structured JSON.',
    });

    try {
      const parsed = JSON.parse(response.content);
      return {
        sentiment: parsed.sentiment ?? 'neutral',
        intent: parsed.intent ?? 'needs_info',
        suggestedAction: parsed.suggested_action ?? 'Follow up',
      };
    } catch {
      return {
        sentiment: 'neutral',
        intent: 'needs_info',
        suggestedAction: 'Manual review needed',
      };
    }
  }

  shouldExecute(): boolean {
    return this.config.mode === 'autopilot';
  }

  shouldSuggest(): boolean {
    return this.config.mode === 'copilot';
  }
}
