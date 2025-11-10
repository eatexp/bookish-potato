/**
 * OpenAI Model Provider
 *
 * API provider for OpenAI GPT models using the Chat Completions API.
 * Supports both completion and streaming modes.
 *
 * @see https://platform.openai.com/docs/api-reference/chat
 */

import {
  APIProviderConfig,
  BaseModelProvider,
  InferenceParams,
  InferenceResponse,
  ProviderHealth,
  StreamChunk,
} from '../core/model-provider';

/**
 * OpenAI Chat Completions API request
 */
interface OpenAIChatRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string | string[];
  stream?: boolean;
}

/**
 * OpenAI Chat Completions API response
 */
interface OpenAIChatResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: 'stop' | 'length' | 'content_filter' | null;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI streaming chunk
 */
interface OpenAIChatStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
    };
    finish_reason: 'stop' | 'length' | 'content_filter' | null;
  }>;
}

/**
 * OpenAI error response
 */
interface OpenAIErrorResponse {
  error?: {
    message?: string;
  } | string;
}

/**
 * OpenAI models list response
 */
interface OpenAIModelsResponse {
  object: 'list';
  data: Array<{
    id: string;
    object: 'model';
    created: number;
    owned_by: string;
  }>;
}

export class OpenAIProvider extends BaseModelProvider {
  readonly name = 'openai';
  readonly type = 'api' as const;

  private apiKey: string;
  private baseUrl: string;
  private timeout: number;
  private organization?: string;

  constructor(config: APIProviderConfig) {
    super(config);

    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.timeout = config.timeout || 120000; // 2 minutes default
    this.organization = config.organization;
  }

  /**
   * Check if provider is available
   * @note Must be async to match ModelProvider interface
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async isAvailable(): Promise<boolean> {
    try {
      // Simple check: verify API key format
      if (!this.apiKey || !this.apiKey.startsWith('sk-')) {
        return false;
      }

      // Could make a test request, but that costs money
      // For now, just verify configuration is valid
      return true;
    } catch (error) {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.apiKey}`,
      };

      if (this.organization) {
        headers['OpenAI-Organization'] = this.organization;
      }

      const response = await fetch(`${this.baseUrl}/models`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.statusText}`);
      }

      const data = (await response.json()) as OpenAIModelsResponse;

      // Filter to only chat models
      return data.data
        .filter((model) => model.id.includes('gpt') || model.id.includes('o1'))
        .map((model) => model.id)
        .sort();
    } catch (error) {
      // If API call fails, return known models
      return [
        'gpt-5',
        'gpt-5-mini',
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'gpt-4',
        'gpt-3.5-turbo',
        'o1',
        'o1-mini',
      ];
    }
  }

  async generate(model: string, params: InferenceParams): Promise<InferenceResponse> {
    const startTime = Date.now();

    try {
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

      if (params.systemPrompt) {
        messages.push({
          role: 'system',
          content: params.systemPrompt,
        });
      }

      messages.push({
        role: 'user',
        content: params.prompt,
      });

      const requestBody: OpenAIChatRequest = {
        model,
        messages,
        max_tokens: params.maxTokens,
        temperature: params.temperature,
        top_p: params.topP,
        stop: params.stop,
        stream: false,
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      };

      if (this.organization) {
        headers['OpenAI-Organization'] = this.organization;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({ error: response.statusText }))) as OpenAIErrorResponse;
        const errorMsg =
          (typeof errorData.error === 'object' ? errorData.error.message : errorData.error) ||
          `HTTP ${response.status}`;
        throw new Error(`OpenAI API error: ${errorMsg}`);
      }

      const data = (await response.json()) as OpenAIChatResponse;
      const latencyMs = Date.now() - startTime;

      const choice = data.choices[0];
      if (!choice) {
        throw new Error('No completion choices returned');
      }

      return {
        text: choice.message.content,
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
        latencyMs,
        model: data.model,
        provider: this.name,
        finishReason: this.mapFinishReason(choice.finish_reason),
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      if (error instanceof Error && error.name === 'AbortError') {
        return {
          text: '',
          promptTokens: this.estimateTokens(params.prompt),
          completionTokens: 0,
          totalTokens: this.estimateTokens(params.prompt),
          latencyMs,
          model,
          provider: this.name,
          finishReason: 'error',
          error: 'Request timeout',
        };
      }

      throw error;
    }
  }

  async *generateStream(
    model: string,
    params: InferenceParams
  ): AsyncGenerator<StreamChunk, InferenceResponse, undefined> {
    const startTime = Date.now();
    let fullResponse = '';
    let promptTokens = 0;
    let completionTokens = 0;
    let finishReason: 'stop' | 'length' | 'content_filter' | null = null;

    try {
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

      if (params.systemPrompt) {
        messages.push({
          role: 'system',
          content: params.systemPrompt,
        });
      }

      messages.push({
        role: 'user',
        content: params.prompt,
      });

      const requestBody: OpenAIChatRequest = {
        model,
        messages,
        max_tokens: params.maxTokens,
        temperature: params.temperature,
        top_p: params.topP,
        stop: params.stop,
        stream: true,
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      };

      if (this.organization) {
        headers['OpenAI-Organization'] = this.organization;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({ error: response.statusText }))) as OpenAIErrorResponse;
        const errorMsg =
          (typeof errorData.error === 'object' ? errorData.error.message : errorData.error) ||
          `HTTP ${response.status}`;
        throw new Error(`OpenAI API error: ${errorMsg}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6); // Remove "data: " prefix

            if (jsonStr === '[DONE]') {
              continue;
            }

            try {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              const data: OpenAIChatStreamChunk = JSON.parse(jsonStr);

              const choice = data.choices[0];
              if (!choice) {
                continue;
              }

              if (choice.delta.content) {
                const text = choice.delta.content;
                fullResponse += text;

                yield {
                  text,
                  done: false,
                  model: data.model,
                };
              }

              if (choice.finish_reason) {
                finishReason = choice.finish_reason;
              }
            } catch (parseError) {
              // Skip malformed JSON
              continue;
            }
          }
        }
      }

      const latencyMs = Date.now() - startTime;

      // Estimate tokens since streaming doesn't return usage
      promptTokens = this.estimateTokens(params.prompt);
      if (params.systemPrompt) {
        promptTokens += this.estimateTokens(params.systemPrompt);
      }
      completionTokens = this.estimateTokens(fullResponse);

      return {
        text: fullResponse,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        latencyMs,
        model,
        provider: this.name,
        finishReason: this.mapFinishReason(finishReason),
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      if (error instanceof Error && error.name === 'AbortError') {
        return {
          text: fullResponse,
          promptTokens: this.estimateTokens(params.prompt),
          completionTokens: this.estimateTokens(fullResponse),
          totalTokens:
            this.estimateTokens(params.prompt) + this.estimateTokens(fullResponse),
          latencyMs,
          model,
          provider: this.name,
          finishReason: 'error',
          error: 'Request timeout',
        };
      }

      throw error;
    }
  }

  override async healthCheck(): Promise<ProviderHealth> {
    const startTime = Date.now();

    try {
      const available = await this.isAvailable();
      if (!available) {
        return {
          healthy: false,
          error: 'Invalid or missing OpenAI API key',
          warnings: ['Set OPENAI_API_KEY environment variable'],
        };
      }

      const models = await this.listModels();
      const latencyMs = Date.now() - startTime;

      return {
        healthy: true,
        latencyMs,
        modelCount: models.length,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private mapFinishReason(
    reason: 'stop' | 'length' | 'content_filter' | null
  ): 'completed' | 'length' | 'stop' | 'error' {
    switch (reason) {
      case 'stop':
        return 'completed';
      case 'length':
        return 'length';
      case 'content_filter':
        return 'error';
      default:
        return 'completed';
    }
  }
}
