/**
 * Campaign Copy Generator — marketing-focused content generation.
 *
 * Unlike RevOps EmailCopilot (1:1 sales emails), this generates
 * broadcast campaign copy: subject lines, preview text, body content,
 * and CTAs for marketing campaigns targeting segments.
 */

export type CampaignGoal =
  | 'nurture'
  | 'promotion'
  | 'announcement'
  | 'reengagement'
  | 'event_invite'
  | 'newsletter';

export type CopyTone =
  | 'professional'
  | 'friendly'
  | 'urgent'
  | 'educational'
  | 'conversational';

export interface CopyGenerationRequest {
  goal: CampaignGoal;
  tone: CopyTone;
  productName: string;
  audienceDescription: string;
  keyMessage: string;
  ctaText?: string;
  generateVariants?: number; // How many A/B variants
}

export interface GeneratedCopy {
  subjectLine: string;
  previewText: string;
  headline: string;
  bodyHtml: string;
  ctaText: string;
  ctaUrl?: string;
}

export interface CopyGenerationResult {
  primary: GeneratedCopy;
  variants: GeneratedCopy[];
}

export interface CopyLLMProvider {
  complete(prompt: string, opts: { temperature: number; maxTokens: number; systemPrompt: string }): Promise<{ content: string }>;
}

export class CopyGenerator {
  constructor(private readonly llm: CopyLLMProvider) {}

  async generate(request: CopyGenerationRequest): Promise<CopyGenerationResult> {
    const variantCount = Math.min(request.generateVariants ?? 0, 3);
    const prompt = this.buildPrompt(request, variantCount);

    const response = await this.llm.complete(prompt, {
      temperature: 0.8,
      maxTokens: 2048,
      systemPrompt: SYSTEM_PROMPT,
    });

    try {
      const parsed = JSON.parse(response.content);
      return {
        primary: this.parseCopy(parsed.primary ?? parsed),
        variants: (parsed.variants ?? []).map((v: any) => this.parseCopy(v)),
      };
    } catch {
      return this.fallback(request);
    }
  }

  /**
   * Generate subject line variations for A/B testing.
   */
  async generateSubjectLines(
    context: { goal: CampaignGoal; tone: CopyTone; keyMessage: string },
    count: number = 5,
  ): Promise<string[]> {
    const prompt = `Generate ${count} email subject lines for a ${context.goal} campaign.
Tone: ${context.tone}
Key message: ${context.keyMessage}

Return a JSON array of strings. Each should be unique in approach (question, stat, personalization, urgency, curiosity).`;

    const response = await this.llm.complete(prompt, {
      temperature: 0.9,
      maxTokens: 512,
      systemPrompt: 'You are an expert email marketer. Return JSON array of subject line strings only.',
    });

    try {
      return JSON.parse(response.content);
    } catch {
      return [
        `${context.keyMessage}`,
        `You'll want to see this: ${context.keyMessage}`,
        `Quick update: ${context.keyMessage}`,
      ];
    }
  }

  private buildPrompt(request: CopyGenerationRequest, variantCount: number): string {
    return `Generate marketing email copy for a ${request.goal} campaign.

Product: ${request.productName}
Target audience: ${request.audienceDescription}
Key message: ${request.keyMessage}
Tone: ${request.tone}
${request.ctaText ? `CTA text: ${request.ctaText}` : ''}

Return JSON with:
- primary: { subjectLine, previewText, headline, bodyHtml, ctaText }
  - bodyHtml should be clean HTML paragraphs (no full document, just <p> and inline elements)
  - previewText should be ~100 chars (shown in inbox preview)
${variantCount > 0 ? `- variants: array of ${variantCount} alternative versions with different subject lines and approaches` : ''}`;
  }

  private parseCopy(raw: any): GeneratedCopy {
    return {
      subjectLine: raw.subjectLine ?? raw.subject_line ?? '',
      previewText: raw.previewText ?? raw.preview_text ?? '',
      headline: raw.headline ?? '',
      bodyHtml: raw.bodyHtml ?? raw.body_html ?? raw.body ?? '',
      ctaText: raw.ctaText ?? raw.cta_text ?? 'Learn more',
      ctaUrl: raw.ctaUrl ?? raw.cta_url,
    };
  }

  private fallback(request: CopyGenerationRequest): CopyGenerationResult {
    const goalMap: Record<CampaignGoal, string> = {
      nurture: 'Stay in the loop',
      promotion: 'Limited time offer',
      announcement: 'Exciting news',
      reengagement: 'We miss you',
      event_invite: "You're invited",
      newsletter: 'This week at',
    };

    return {
      primary: {
        subjectLine: `${goalMap[request.goal]} — ${request.productName}`,
        previewText: request.keyMessage.slice(0, 100),
        headline: request.keyMessage,
        bodyHtml: `<p>${request.keyMessage}</p>`,
        ctaText: request.ctaText ?? 'Learn more',
      },
      variants: [],
    };
  }
}

const SYSTEM_PROMPT = `You are an expert marketing copywriter for email campaigns.
Write compelling, conversion-focused copy. Follow these principles:
- Subject lines: 6-10 words, create curiosity or urgency
- Preview text: complement the subject, don't repeat it
- Body: scannable, benefit-focused, one clear message per email
- CTA: action-oriented, specific (not just "Click here")
Return JSON only.`;
