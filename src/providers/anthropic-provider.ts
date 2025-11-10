/**
 * Anthropic Model Provider
 *
 * API provider for Anthropic Claude models using the Messages API.
 * Supports both completion and streaming modes.
 *
 * @see https://docs.anthropic.com/en/api/messages
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
 * Anthropic Messages API request
 */
interface AnthropicMessagesRequest {
  model: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  stop_sequences?: string[];
  system?: string;
  stream?: boolean;
}

/**
 * Anthropic Messages API response
 */
interface AnthropicMessagesResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text';
    text: string;
  }>;
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Anthropic streaming event types
 */
interface AnthropicStreamEvent {
  type:
    | 'message_start'
    | 'content_block_start'
    | 'content_block_delta'
    | 'content_block_stop'
    | 'message_delta'
    | 'message_stop'
    | 'ping'
    | 'error';
  message?: AnthropicMessagesResponse;
  delta?: {
    type: 'text_delta';
    text: string;
  };
  usage?: {
    output_tokens: number;
  };
  error?: {
    type: string;
    message: string;
  };
}

/**
 * Available Anthropic models
 */
const ANTHROPIC_MODELS = [
  'claude-opus-4-20250514',
  'claude-opus-4',
  'claude-sonnet-4-20250514',
  'claude-sonnet-4',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307',
];

export class AnthropicProvider extends BaseModelProvider {
  readonly name = 'anthropic';
  readonly type = 'api' as const;

  private apiKey: string;
  private baseUrl: string;
  private timeout: number;
  private apiVersion: string;

  constructor(config: APIProviderConfig) {
    super(config);

    if (!config.apiKey) {
      throw new Error('Anthropic API key is required');
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com';
    this.timeout = config.timeout || 120000; // 2 minutes default
    this.apiVersion = '2023-06-01';
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Simple check: verify API key format
      if (!this.apiKey || !this.apiKey.startsWith('sk-ant-')) {
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
    // Anthropic doesn't provide a models endpoint
    // Return the known available models
    return [...ANTHROPIC_MODELS];
  }

  async generate(model: string, params: InferenceParams): Promise<InferenceResponse> {
    const startTime = Date.now();

    try {
      const requestBody: AnthropicMessagesRequest = {
        model,
        messages: [
          {
            role: 'user',
            content: params.prompt,
          },
        ],
        max_tokens: params.maxTokens || 4096,
        temperature: params.temperature,
        top_p: params.topP,
        stop_sequences: params.stop,
        system: params.systemPrompt,
        stream: false,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': this.apiVersion,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({ error: response.statusText }))) as any;
        const errorMsg =
          errorData.error?.message || errorData.error || `HTTP ${response.status}`;
        throw new Error(`Anthropic API error: ${errorMsg}`);
      }

      const data = (await response.json()) as AnthropicMessagesResponse;
      const latencyMs = Date.now() - startTime;

      const text = data.content.map((c) => c.text).join('');

      return {
        text,
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        latencyMs,
        model: data.model,
        provider: this.name,
        finishReason: this.mapStopReason(data.stop_reason),
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
    const stopReason: 'end_turn' | 'max_tokens' | 'stop_sequence' | null = null;

    try {
      const requestBody: AnthropicMessagesRequest = {
        model,
        messages: [
          {
            role: 'user',
            content: params.prompt,
          },
        ],
        max_tokens: params.maxTokens || 4096,
        temperature: params.temperature,
        top_p: params.topP,
        stop_sequences: params.stop,
        system: params.systemPrompt,
        stream: true,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': this.apiVersion,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({ error: response.statusText }))) as any;
        const errorMsg =
          errorData.error?.message || errorData.error || `HTTP ${response.status}`;
        throw new Error(`Anthropic API error: ${errorMsg}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6); // Remove "data: " prefix

            try {
              const event: AnthropicStreamEvent = JSON.parse(jsonStr);

              if (event.type === 'message_start' && event.message) {
                promptTokens = event.message.usage.input_tokens;
              } else if (event.type === 'content_block_delta' && event.delta) {
                const text = event.delta.text;
                fullResponse += text;

                yield {
                  text,
                  done: false,
                  model,
                };
              } else if (event.type === 'message_delta' && event.usage) {
                completionTokens = event.usage.output_tokens;
              } else if (event.type === 'message_stop') {
                // Stream complete
              } else if (event.type === 'error' && event.error) {
                throw new Error(`Stream error: ${event.error.message}`);
              }
            } catch (parseError) {
              // Skip malformed JSON
              continue;
            }
          }
        }
      }

      const latencyMs = Date.now() - startTime;

      return {
        text: fullResponse,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        latencyMs,
        model,
        provider: this.name,
        finishReason: this.mapStopReason(stopReason),
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
          error: 'Invalid or missing Anthropic API key',
          warnings: ['Set ANTHROPIC_API_KEY environment variable'],
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

  private mapStopReason(
    reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | null
  ): 'completed' | 'length' | 'stop' | 'error' {
    switch (reason) {
      case 'end_turn':
        return 'completed';
      case 'max_tokens':
        return 'length';
      case 'stop_sequence':
        return 'stop';
      default:
        return 'completed';
    }
  }
}
