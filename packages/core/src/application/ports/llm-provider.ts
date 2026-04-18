export interface LLMMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface LLMGenerateOptions {
  readonly messages: readonly LLMMessage[];
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly stop?: readonly string[];
}

export interface LLMJsonOptions<T> extends LLMGenerateOptions {
  readonly jsonSchemaName: string;
  readonly parse: (raw: string) => T;
}

export interface LLMProvider {
  generate(options: LLMGenerateOptions): Promise<string>;
  generateJson<T>(options: LLMJsonOptions<T>): Promise<T>;
}
