/**
 * API-First Router - Always routes to cloud APIs
 *
 * Prioritizes cloud API execution for maximum quality.
 * Ideal for:
 * - Users with unlimited API budget
 * - Quality-critical workloads
 * - Teams that value time over cost
 */

import {
  BaseModelRouter,
  InferenceRequest,
  RouteDecision,
  RoutingOptions,
} from '../core/model-router';

export interface APIFirstRouterConfig {
  /** Default API model to use */
  defaultModel?: string;
  /** Default provider (default: 'anthropic') */
  defaultProvider?: string;
  /** Fallback to local if API unavailable */
  fallbackToLocal?: boolean;
  /** Local fallback model */
  localFallbackModel?: string;
}

/**
 * API-first router that prioritizes cloud APIs
 */
export class APIFirstRouter extends BaseModelRouter {
  readonly name = 'api-first';
  private config: Required<APIFirstRouterConfig>;

  constructor(config: APIFirstRouterConfig = {}) {
    super();

    this.config = {
      defaultModel: config.defaultModel || 'claude-opus-4',
      defaultProvider: config.defaultProvider || 'anthropic',
      fallbackToLocal: config.fallbackToLocal ?? true,
      localFallbackModel: config.localFallbackModel || 'qwen3-coder-30b',
    };
  }

  async route(request: InferenceRequest, options?: RoutingOptions): Promise<RouteDecision> {
    // Force overrides if specified
    if (options?.forceModel || options?.forceProvider) {
      const model = options.forceModel || this.config.defaultModel;
      const provider = options.forceProvider || this.config.defaultProvider;
      const tokens = request.estimatedTokens || 5000;

      // If forced to local, create local decision
      if (provider === 'ollama') {
        return this.createLocalDecision(provider, model, 'User override: forced to local', tokens);
      }

      // Otherwise create API decision
      const pricing = this.getModelPricing(provider, model);
      return this.createAPIDecision(
        provider,
        model,
        'User override: forced to specific API',
        tokens,
        pricing
      );
    }

    const tokens = request.estimatedTokens || 5000;

    // Task-specific routing
    if (request.taskType === 'quantum') {
      // Quantum tasks use specialized local model
      return this.createLocalDecision(
        'ollama',
        'granite-8b-qiskit',
        'Quantum task requires specialized local model',
        tokens
      );
    }

    // Complex tasks -> GPT-5 for frontier reasoning
    if (request.complexity !== undefined && request.complexity > 0.8) {
      const pricing = this.getModelPricing('openai', 'gpt-5');
      return this.createAPIDecision(
        'openai',
        'gpt-5',
        'High complexity task routed to frontier model (GPT-5)',
        tokens,
        pricing
      );
    }

    // Large context -> Claude Opus for 200K window
    if (tokens > 16000) {
      const pricing = this.getModelPricing('anthropic', 'claude-opus-4');
      return this.createAPIDecision(
        'anthropic',
        'claude-opus-4',
        'Large context requires Claude Opus 200K window',
        tokens,
        pricing
      );
    }

    // Default: use configured API model
    const pricing = this.getModelPricing(this.config.defaultProvider, this.config.defaultModel);
    return this.createAPIDecision(
      this.config.defaultProvider,
      this.config.defaultModel,
      `Default API routing (${this.config.defaultModel})`,
      tokens,
      pricing
    );
  }
}
