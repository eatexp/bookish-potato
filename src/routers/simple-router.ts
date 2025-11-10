/**
 * Simple Router - Always routes to local models
 *
 * Zero-cost, zero-config router that always uses local models.
 * Ideal for:
 * - Users with no API budget
 * - Air-gapped/offline environments
 * - Privacy-sensitive workloads
 */

import {
  BaseModelRouter,
  InferenceRequest,
  RouteDecision,
  RoutingOptions,
} from '../core/model-router';

export interface SimpleRouterConfig {
  /** Default local model to use */
  defaultModel?: string;
  /** Default provider (default: 'ollama') */
  defaultProvider?: string;
}

/**
 * Simple router that always routes to local models
 */
export class SimpleRouter extends BaseModelRouter {
  readonly name = 'simple';
  private config: Required<SimpleRouterConfig>;

  constructor(config: SimpleRouterConfig = {}) {
    super();

    this.config = {
      defaultModel: config.defaultModel || 'qwen3-coder-30b',
      defaultProvider: config.defaultProvider || 'ollama',
    };
  }

  /**
   * Route inference request (always to local models)
   * @note Must be async to match ModelRouter interface
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async route(request: InferenceRequest, options?: RoutingOptions): Promise<RouteDecision> {
    // Force overrides if specified
    if (options?.forceModel || options?.forceProvider) {
      const model = options.forceModel || this.config.defaultModel;
      const provider = options.forceProvider || this.config.defaultProvider;

      return this.createLocalDecision(
        provider,
        model,
        'User override: forced to specific model',
        request.estimatedTokens || 1000
      );
    }

    // Task-specific routing
    if (request.taskType === 'quantum') {
      return this.createLocalDecision(
        'ollama',
        'granite-8b-qiskit',
        'Quantum task routed to specialized local model',
        request.estimatedTokens || 1000
      );
    }

    // Default: use configured local model
    return this.createLocalDecision(
      this.config.defaultProvider,
      this.config.defaultModel,
      `Default local routing (${this.config.defaultModel})`,
      request.estimatedTokens || 1000
    );
  }
}
