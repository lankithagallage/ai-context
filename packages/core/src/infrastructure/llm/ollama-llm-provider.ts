import type {
  LLMGenerateOptions,
  LLMJsonOptions,
  LLMProvider,
} from '../../application/ports/llm-provider.js';

export interface OllamaConfig {
  readonly baseUrl: string;
  readonly model: string;
  readonly temperature: number;
  readonly requestTimeoutMs: number;
}

interface OllamaChatRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream: false;
  format?: 'json';
  options?: {
    temperature?: number;
    num_predict?: number;
    stop?: string[];
  };
}

interface OllamaChatResponse {
  message?: { role: string; content: string };
  error?: string;
}

export class OllamaLLMProvider implements LLMProvider {
  constructor(private readonly config: OllamaConfig) {}

  async generate(options: LLMGenerateOptions): Promise<string> {
    return this.call(options);
  }

  async generateJson<T>(options: LLMJsonOptions<T>): Promise<T> {
    const raw = await this.call(options, 'json');
    try {
      return options.parse(raw);
    } catch (cause) {
      throw new Error(
        `Ollama returned invalid JSON for "${options.jsonSchemaName}": ${(cause as Error).message}`,
        { cause },
      );
    }
  }

  private async call(options: LLMGenerateOptions, format?: 'json'): Promise<string> {
    const body: OllamaChatRequest = {
      model: this.config.model,
      stream: false,
      messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
      options: {
        temperature: options.temperature ?? this.config.temperature,
        ...(options.maxTokens !== undefined ? { num_predict: options.maxTokens } : {}),
        ...(options.stop !== undefined ? { stop: [...options.stop] } : {}),
      },
      ...(format ? { format } : {}),
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

    try {
      const res = await fetch(`${this.config.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Ollama request failed (${res.status}): ${text}`);
      }

      const data = (await res.json()) as OllamaChatResponse;
      if (data.error) throw new Error(`Ollama error: ${data.error}`);
      if (!data.message?.content) throw new Error('Ollama response missing message.content');
      return data.message.content;
    } finally {
      clearTimeout(timeout);
    }
  }
}
