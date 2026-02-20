import type { LLMProvider } from './llm-provider.js';

export interface CoachingRequest {
  type: 'email_review' | 'call_prep' | 'objection_handling';
  content: string;
  dealContext?: {
    stage: string;
    value: number;
    contactName: string;
    company: string;
  };
}

export interface CoachingFeedback {
  score: number; // 0-100
  strengths: string[];
  improvements: string[];
  suggestedRevision?: string;
}

export class SalesCoach {
  constructor(private readonly llm: LLMProvider) {}

  async review(request: CoachingRequest): Promise<CoachingFeedback> {
    const prompt = this.buildPrompt(request);

    const response = await this.llm.complete(prompt, {
      temperature: 0.3,
      maxTokens: 1024,
      systemPrompt:
        'You are an experienced sales coach. Provide actionable, specific feedback. Respond with JSON.',
    });

    try {
      const parsed = JSON.parse(response.content);
      return {
        score: parsed.score ?? 50,
        strengths: parsed.strengths ?? [],
        improvements: parsed.improvements ?? [],
        suggestedRevision: parsed.suggested_revision,
      };
    } catch {
      return {
        score: 50,
        strengths: ['Content provided for review'],
        improvements: ['Unable to parse detailed feedback'],
      };
    }
  }

  private buildPrompt(request: CoachingRequest): string {
    const context = request.dealContext
      ? `\nDeal Context: ${request.dealContext.contactName} at ${request.dealContext.company}, Stage: ${request.dealContext.stage}, Value: $${request.dealContext.value}`
      : '';

    switch (request.type) {
      case 'email_review':
        return `Review this sales email for effectiveness:${context}\n\nEmail:\n${request.content}\n\nProvide: score (0-100), strengths[], improvements[], suggested_revision`;
      case 'call_prep':
        return `Prepare talking points for this sales call:${context}\n\nNotes:\n${request.content}\n\nProvide: score (0-100), strengths[], improvements[]`;
      case 'objection_handling':
        return `Suggest responses to this objection:${context}\n\nObjection:\n${request.content}\n\nProvide: score (0-100), strengths[], improvements[], suggested_revision`;
    }
  }
}
