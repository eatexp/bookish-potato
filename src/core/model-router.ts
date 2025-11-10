/**
 * Model Router - ADR-002
 *
 * Core abstractions for intelligent routing between local models and cloud APIs.
 * Implements plugin-based architecture for extensible routing strategies.
 */

/**
 * Inference request to be routed
 */
export interface InferenceRequest {
  /** The prompt or task to execute */
  prompt: string;
  /** Estimated token count (input + expected output) */
  estimatedTokens?: number;
  /** Task type for specialized routing (e.g., 'quantum', 'code-review') */
  taskType?: string;
  /** Complexity score (0-1) for escalation decisions */
  complexity?: number;
  /** Additional context/metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Target model/API for execution
 */
export interface ModelTarget {
  /** Execution type */
  type: 'local' | 'api';
  /** Provider name */
  provider: string; // 'ollama' | 'anthropic' | 'openai' | custom
  /** Model identifier */
  model: string; // 'qwen3-coder-30b' | 'claude-opus-4' | 'gpt-5'
  /** Optional custom endpoint */
  endpoint?: string;
}

/**
 * Routing decision with cost and rationale
 */
export interface RouteDecision {
  /** Selected target for execution */
  target: ModelTarget;
  /** Estimated cost in USD */
  estimatedCost: number;
  /** Estimated latency in seconds */
  estimatedLatency: number;
  /** Human-readable explanation */
  rationale: string;
  /** Alternative viable options (for --explain mode) */
  alternatives?: RouteDecision[];
  /** Confidence score (0-1) in this decision */
  confidence?: number;
}

/**
 * Options for routing decisions
 */
export interface RoutingOptions {
  /** Dry-run mode: estimate only, don't execute */
  dryRun?: boolean;
  /** Generate detailed explanation with alternatives */
  explain?: boolean;
  /** Override monthly budget limit */
  budgetOverride?: number;
  /** Force specific provider */
  forceProvider?: string;
  /** Force specific model */
  forceModel?: string;
}

/**
 * Model Router interface
 * Implement this to create custom routing strategies
 */
export interface ModelRouter {
  /** Router name for identification */
  readonly name: string;

  /**
   * Determine optimal model/API for a request
   * @param request - The inference request
   * @param options - Routing options
   * @returns Route decision with cost estimate and rationale
   */
  route(request: InferenceRequest, options?: RoutingOptions): Promise<RouteDecision>;
}

/**
 * Pricing information for a model
 */
export interface ModelPricing {
  /** Cost per million input tokens (USD) */
  inputCostPerMToken: number;
  /** Cost per million output tokens (USD) */
  outputCostPerMToken: number;
  /** Average latency per 1K tokens (seconds) */
  latencyPerKToken?: number;
}

/**
 * Base router with helper methods for common operations
 */
export abstract class BaseModelRouter implements ModelRouter {
  abstract readonly name: string;
  abstract route(request: InferenceRequest, options?: RoutingOptions): Promise<RouteDecision>;

  /**
   * Estimate cost for a given target and token count
   */
  protected estimateCost(target: ModelTarget, tokens: number, pricing: ModelPricing): number {
    if (target.type === 'local') {
      return 0; // Local models are free
    }

    // Assume 2:1 input:output ratio for estimation
    const inputTokens = tokens * 0.67;
    const outputTokens = tokens * 0.33;

    const inputCost = (inputTokens / 1_000_000) * pricing.inputCostPerMToken;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputCostPerMToken;

    return inputCost + outputCost;
  }

  /**
   * Estimate latency for a target and token count
   */
  protected estimateLatency(target: ModelTarget, tokens: number, pricing: ModelPricing): number {
    if (target.type === 'local') {
      // Local models: ~10-20 tokens/second on RTX 5090
      return (tokens / 15) / 1000; // Convert to seconds
    }

    // API latency varies by model
    const baseLatency = pricing.latencyPerKToken || 2; // Default 2s per 1K tokens
    return (tokens / 1000) * baseLatency;
  }

  /**
   * Create a route decision for local execution
   */
  protected createLocalDecision(
    provider: string,
    model: string,
    rationale: string,
    tokens: number = 1000,
    pricing?: ModelPricing
  ): RouteDecision {
    const target: ModelTarget = { type: 'local', provider, model };
    const defaultPricing: ModelPricing = {
      inputCostPerMToken: 0,
      outputCostPerMToken: 0,
      latencyPerKToken: 0.067, // ~15 tokens/sec
    };

    return {
      target,
      estimatedCost: 0,
      estimatedLatency: this.estimateLatency(target, tokens, pricing || defaultPricing),
      rationale,
      confidence: 0.9,
    };
  }

  /**
   * Create a route decision for API execution
   */
  protected createAPIDecision(
    provider: string,
    model: string,
    rationale: string,
    tokens: number,
    pricing: ModelPricing
  ): RouteDecision {
    const target: ModelTarget = { type: 'api', provider, model };

    return {
      target,
      estimatedCost: this.estimateCost(target, tokens, pricing),
      estimatedLatency: this.estimateLatency(target, tokens, pricing),
      rationale,
      confidence: 0.85,
    };
  }

  /**
   * Get standard pricing for common models
   */
  protected getModelPricing(_provider: string, model: string): ModelPricing {
    // Standard pricing as of 2025
    const pricingTable: Record<string, ModelPricing> = {
      // Anthropic
      'claude-opus-4': {
        inputCostPerMToken: 15,
        outputCostPerMToken: 75,
        latencyPerKToken: 2.5,
      },
      'claude-sonnet-4': {
        inputCostPerMToken: 3,
        outputCostPerMToken: 15,
        latencyPerKToken: 1.5,
      },

      // OpenAI
      'gpt-5': {
        inputCostPerMToken: 20,
        outputCostPerMToken: 100,
        latencyPerKToken: 3.0,
      },
      'gpt-4-turbo': {
        inputCostPerMToken: 10,
        outputCostPerMToken: 30,
        latencyPerKToken: 2.0,
      },

      // Local models (all zero cost)
      'qwen3-coder-30b': {
        inputCostPerMToken: 0,
        outputCostPerMToken: 0,
        latencyPerKToken: 0.067,
      },
      'llama-3.1-70b': {
        inputCostPerMToken: 0,
        outputCostPerMToken: 0,
        latencyPerKToken: 0.1,
      },
      'granite-8b-qiskit': {
        inputCostPerMToken: 0,
        outputCostPerMToken: 0,
        latencyPerKToken: 0.05,
      },
    };

    const key = `${model}`;
    return (
      pricingTable[key] || {
        inputCostPerMToken: 5,
        outputCostPerMToken: 15,
        latencyPerKToken: 2.0,
      }
    );
  }
}
