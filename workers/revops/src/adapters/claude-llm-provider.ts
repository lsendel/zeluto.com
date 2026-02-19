import type { LLMProvider, LLMOptions, LLMResponse } from '@mauntic/revops-domain';
import Anthropic from '@anthropic-ai/sdk';

export class ClaudeLLMProvider implements LLMProvider {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async complete(prompt: string, options?: LLMOptions): Promise<LLMResponse> {
    const response = await this.client.messages.create({
      model: options?.model ?? 'claude-sonnet-4-6',
      max_tokens: options?.maxTokens ?? 1024,
      temperature: options?.temperature ?? 0.7,
      system: options?.systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');

    return {
      content,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }

  async *stream(prompt: string, options?: LLMOptions): AsyncIterable<string> {
    const stream = this.client.messages.stream({
      model: options?.model ?? 'claude-sonnet-4-6',
      max_tokens: options?.maxTokens ?? 1024,
      temperature: options?.temperature ?? 0.7,
      system: options?.systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  }
}
