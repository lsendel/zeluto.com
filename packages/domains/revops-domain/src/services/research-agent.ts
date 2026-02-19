import type { LLMProvider } from './llm-provider.js';

export interface ResearchRequest {
  contactId: string;
  organizationId: string;
  type: 'company' | 'person';
  contactData: {
    email?: string;
    name?: string;
    company?: string;
    title?: string;
    linkedinUrl?: string;
  };
}

export interface ResearchInsight {
  insightType: string;
  content: string;
  relevance: number; // 0-1
  freshness: number; // 0-1
  source?: string;
}

export interface ResearchResult {
  contactId: string;
  insights: ResearchInsight[];
  rawData: Record<string, unknown>;
}

// Insight types for company research
export type CompanyInsightType =
  | 'company_profile' | 'funding_history' | 'tech_stack'
  | 'hiring_signals' | 'recent_news' | 'competitive_landscape'
  | 'growth_indicators';

// Insight types for person research
export type PersonInsightType =
  | 'professional_background' | 'recent_publications'
  | 'shared_connections' | 'career_trajectory' | 'interests'
  | 'social_presence' | 'speaking_engagements';

const QUALITY_THRESHOLD = 0.7;

export class ResearchAgent {
  constructor(private readonly llm: LLMProvider) {}

  async research(request: ResearchRequest): Promise<ResearchResult> {
    const prompt = request.type === 'company'
      ? this.buildCompanyPrompt(request)
      : this.buildPersonPrompt(request);

    const response = await this.llm.complete(prompt, {
      temperature: 0.3,
      maxTokens: 2048,
      systemPrompt: 'You are a sales research analyst. Provide structured, actionable insights.',
    });

    const insights = this.parseInsights(response.content);
    const filtered = insights.filter(
      i => i.relevance * i.freshness >= QUALITY_THRESHOLD,
    );

    return {
      contactId: request.contactId,
      insights: filtered,
      rawData: { response: response.content, usage: response.usage },
    };
  }

  private buildCompanyPrompt(request: ResearchRequest): string {
    return `Research the company "${request.contactData.company}" for a B2B sales context.
Provide insights about: company profile, funding, tech stack, hiring signals, news, competitors, growth.
Format each insight as: TYPE: content (relevance: 0-1, freshness: 0-1)
Contact name: ${request.contactData.name ?? 'unknown'}`;
  }

  private buildPersonPrompt(request: ResearchRequest): string {
    return `Research "${request.contactData.name}" at "${request.contactData.company}" (${request.contactData.title ?? 'unknown title'}).
Provide insights about: background, publications, connections, career, interests, social presence.
Format each insight as: TYPE: content (relevance: 0-1, freshness: 0-1)`;
  }

  private parseInsights(content: string): ResearchInsight[] {
    // Simple parsing of structured LLM output
    const lines = content.split('\n').filter(l => l.trim());
    const insights: ResearchInsight[] = [];

    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.+?)(?:\s*\(relevance:\s*([\d.]+),\s*freshness:\s*([\d.]+)\))?$/);
      if (match) {
        insights.push({
          insightType: match[1].toLowerCase(),
          content: match[2].trim(),
          relevance: parseFloat(match[3] ?? '0.5'),
          freshness: parseFloat(match[4] ?? '0.5'),
        });
      }
    }

    return insights;
  }
}
