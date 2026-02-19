import type { LLMProvider } from './llm-provider.js';
import type { ResearchInsight } from './research-agent.js';

export interface EmailGenerationRequest {
  contactName: string;
  company: string;
  title?: string;
  purpose: 'cold_outreach' | 'follow_up' | 'breakup' | 'referral' | 'reengagement';
  insights?: ResearchInsight[];
  previousEmails?: string[];
  tone?: 'professional' | 'casual' | 'direct';
  generateAbVariants?: boolean;
}

export interface GeneratedEmail {
  subject: string;
  body: string;
  personalizationTokens: string[];
}

export interface EmailGenerationResult {
  primary: GeneratedEmail;
  abVariant?: GeneratedEmail;
}

export class EmailCopilot {
  constructor(private readonly llm: LLMProvider) {}

  async generate(request: EmailGenerationRequest): Promise<EmailGenerationResult> {
    const insightContext = request.insights && request.insights.length > 0
      ? `\nResearch Insights:\n${request.insights.map(i => `- ${i.insightType}: ${i.content}`).join('\n')}`
      : '';

    const previousContext = request.previousEmails && request.previousEmails.length > 0
      ? `\nPrevious emails in thread:\n${request.previousEmails.join('\n---\n')}`
      : '';

    const prompt = `Generate a ${request.purpose.replace('_', ' ')} sales email:
To: ${request.contactName}, ${request.title ?? ''} at ${request.company}
Tone: ${request.tone ?? 'professional'}${insightContext}${previousContext}

Respond with JSON: { subject, body, personalization_tokens[] }${request.generateAbVariants ? ', plus ab_variant: { subject, body, personalization_tokens[] }' : ''}`;

    const response = await this.llm.complete(prompt, {
      temperature: 0.7,
      maxTokens: 1024,
      systemPrompt: 'You are an expert sales copywriter. Write concise, personalized emails that drive action. Respond with JSON only.',
    });

    try {
      const parsed = JSON.parse(response.content);
      const result: EmailGenerationResult = {
        primary: {
          subject: parsed.subject,
          body: parsed.body,
          personalizationTokens: parsed.personalization_tokens ?? [],
        },
      };

      if (parsed.ab_variant) {
        result.abVariant = {
          subject: parsed.ab_variant.subject,
          body: parsed.ab_variant.body,
          personalizationTokens: parsed.ab_variant.personalization_tokens ?? [],
        };
      }

      return result;
    } catch {
      return {
        primary: {
          subject: `Following up — ${request.company}`,
          body: `Hi ${request.contactName},\n\nI wanted to reach out regarding...\n\nBest regards`,
          personalizationTokens: ['contactName', 'company'],
        },
      };
    }
  }
}
