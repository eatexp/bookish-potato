/**
 * Model Provider Abstraction
 *
 * Defines interfaces for local and API model providers that execute
 * inference requests. Supports streaming, context management, and
 * consistent error handling across all providers.
 */

/**
 * Inference request with all parameters needed for generation
 */
export interface InferenceParams {
  /** The input prompt or messages */
  prompt: string;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Temperature for sampling (0-2) */
  temperature?: number;
  /** Top-p nucleus sampling */
  topP?: number;
  /** Stop sequences */
  stop?: string[];
  /** Whether to stream the response */
  stream?: boolean;
  /** System prompt/instructions */
  systemPrompt?: string;
  /** Additional model-specific parameters */
  modelParams?: Record<string, unknown>;
}

/**
 * Inference response with usage statistics
 */
export interface InferenceResponse {
  /** The generated text */
  text: string;
  /** Number of tokens in prompt */
  promptTokens: number;
  /** Number of tokens generated */
  completionTokens: number;
  /** Total tokens used */
  totalTokens: number;
  /** Time taken in milliseconds */
  latencyMs: number;
  /** Model used for generation */
  model: string;
  /** Provider name */
  provider: string;
  /** Finish reason (completed, length, stop, error) */
  finishReason: 'completed' | 'length' | 'stop' | 'error';
  /** Optional error message */
  error?: string;
}

/**
 * Streaming chunk during generation
 */
export interface StreamChunk {
  /** Partial generated text */
  text: string;
  /** Whether this is the final chunk */
  done: boolean;
  /** Optional model info */
  model?: string;
}

/**
 * Base model provider interface
 */
export interface ModelProvider {
  /** Provider name (ollama, anthropic, openai) */
  readonly name: string;
  /** Provider type (local or api) */
  readonly type: 'local' | 'api';

  /**
   * Check if provider is available/configured
   */
  isAvailable(): Promise<boolean>;

  /**
   * Generate completion for a prompt
   */
  generate(model: string, params: InferenceParams): Promise<InferenceResponse>;

  /**
   * Stream completion for a prompt
   */
  generateStream(
    model: string,
    params: InferenceParams
  ): AsyncGenerator<StreamChunk, InferenceResponse, undefined>;

  /**
   * List available models
   */
  listModels(): Promise<string[]>;

  /**
   * Get provider health status
   */
  healthCheck(): Promise<ProviderHealth>;
}

/**
 * Provider health status
 */
export interface ProviderHealth {
  /** Whether provider is healthy */
  healthy: boolean;
  /** Response time in ms */
  latencyMs?: number;
  /** Available models count */
  modelCount?: number;
  /** Error message if unhealthy */
  error?: string;
  /** Additional warnings */
  warnings?: string[];
}

/**
 * Configuration for local providers (Ollama)
 */
export interface LocalProviderConfig {
  /** Base URL for Ollama API */
  baseUrl?: string;
  /** Request timeout in ms */
  timeout?: number;
  /** Default model to use */
  defaultModel?: string;
}

/**
 * Configuration for API providers (Anthropic, OpenAI)
 */
export interface APIProviderConfig {
  /** API key for authentication */
  apiKey: string;
  /** Base URL override */
  baseUrl?: string;
  /** Request timeout in ms */
  timeout?: number;
  /** Organization ID (OpenAI) */
  organization?: string;
  /** Default model to use */
  defaultModel?: string;
}

/**
 * Base implementation with common functionality
 */
export abstract class BaseModelProvider implements ModelProvider {
  abstract readonly name: string;
  abstract readonly type: 'local' | 'api';

  protected config: LocalProviderConfig | APIProviderConfig;

  constructor(config: LocalProviderConfig | APIProviderConfig) {
    this.config = config;
  }

  abstract isAvailable(): Promise<boolean>;
  abstract generate(model: string, params: InferenceParams): Promise<InferenceResponse>;
  abstract generateStream(
    model: string,
    params: InferenceParams
  ): AsyncGenerator<StreamChunk, InferenceResponse, undefined>;
  abstract listModels(): Promise<string[]>;

  async healthCheck(): Promise<ProviderHealth> {
    const startTime = Date.now();
    try {
      const available = await this.isAvailable();
      if (!available) {
        return {
          healthy: false,
          error: `Provider ${this.name} is not available`,
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

  /**
   * Helper to calculate tokens (rough estimate: 4 chars per token)
   */
  protected estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Helper to validate model is available
   */
  protected async validateModel(model: string): Promise<void> {
    const models = await this.listModels();
    if (!models.includes(model)) {
      throw new Error(
        `Model ${model} not found. Available models: ${models.join(', ')}`
      );
    }
  }
}
