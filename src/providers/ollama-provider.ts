/**
 * Ollama Model Provider
 *
 * Local model provider using Ollama's REST API.
 * Supports both completion and streaming modes.
 *
 * @see https://github.com/ollama/ollama/blob/main/docs/api.md
 */

import {
  BaseModelProvider,
  InferenceParams,
  InferenceResponse,
  LocalProviderConfig,
  ProviderHealth,
  StreamChunk,
} from '../core/model-provider';

/**
 * Ollama API response for /api/tags
 */
interface OllamaTagsResponse {
  models: Array<{
    name: string;
    modified_at: string;
    size: number;
    digest: string;
    details?: {
      format?: string;
      family?: string;
      families?: string[];
      parameter_size?: string;
      quantization_level?: string;
    };
  }>;
}

/**
 * Ollama API request for /api/generate
 */
interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    stop?: string[];
    num_predict?: number;
  };
}

/**
 * Ollama API response for /api/generate
 */
interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  eval_duration?: number;
}

export class OllamaProvider extends BaseModelProvider {
  readonly name = 'ollama';
  readonly type = 'local' as const;

  private baseUrl: string;
  private timeout: number;

  constructor(config: LocalProviderConfig = {}) {
    super(config);
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.timeout = config.timeout || 120000; // 2 minutes default
  }

  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.statusText}`);
      }

      const data = (await response.json()) as OllamaTagsResponse;
      return data.models.map((model) => model.name);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to list Ollama models: ${error.message}`);
      }
      throw error;
    }
  }

  async generate(model: string, params: InferenceParams): Promise<InferenceResponse> {
    const startTime = Date.now();

    try {
      const requestBody: OllamaGenerateRequest = {
        model,
        prompt: params.prompt,
        system: params.systemPrompt,
        stream: false,
        options: {
          temperature: params.temperature,
          top_p: params.topP,
          stop: params.stop,
          num_predict: params.maxTokens,
        },
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      const data = (await response.json()) as OllamaGenerateResponse;
      const latencyMs = Date.now() - startTime;

      // Ollama provides actual token counts
      const promptTokens = data.prompt_eval_count || this.estimateTokens(params.prompt);
      const completionTokens = data.eval_count || this.estimateTokens(data.response);

      return {
        text: data.response,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        latencyMs,
        model: data.model,
        provider: this.name,
        finishReason: data.done ? 'completed' : 'length',
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

    try {
      const requestBody: OllamaGenerateRequest = {
        model,
        prompt: params.prompt,
        system: params.systemPrompt,
        stream: true,
        options: {
          temperature: params.temperature,
          top_p: params.topP,
          stop: params.stop,
          num_predict: params.maxTokens,
        },
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
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
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const data: OllamaGenerateResponse = JSON.parse(line);

            if (data.response) {
              fullResponse += data.response;

              yield {
                text: data.response,
                done: data.done,
                model: data.model,
              };
            }

            if (data.done) {
              promptTokens = data.prompt_eval_count || this.estimateTokens(params.prompt);
              completionTokens = data.eval_count || this.estimateTokens(fullResponse);
            }
          } catch (parseError) {
            // Skip malformed JSON chunks
            continue;
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
        finishReason: 'completed',
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
          error: 'Ollama service is not running or unreachable',
          warnings: [
            'Make sure Ollama is installed and running',
            `Check connection to ${this.baseUrl}`,
          ],
        };
      }

      const models = await this.listModels();
      const latencyMs = Date.now() - startTime;

      const warnings: string[] = [];
      if (models.length === 0) {
        warnings.push('No models installed. Run "ollama pull <model>" to install models');
      }

      return {
        healthy: true,
        latencyMs,
        modelCount: models.length,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        warnings: [
          'Ensure Ollama is running (check "ollama serve")',
          `Verify base URL: ${this.baseUrl}`,
        ],
      };
    }
  }
}
