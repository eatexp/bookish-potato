/**
 * Cost-Aware Router - Hybrid routing with budget enforcement
 *
 * Implements the 5-tier escalation workflow from the whitepaper:
 * 1. Daily Driver: Qwen3-Coder-30B (local, zero-cost)
 * 2. Complex Local: Llama 3.1 70B (local, higher capability)
 * 3. Novel Patterns: Claude Opus (API, expert reasoning)
 * 4. Quantum Code: granite-8b-qiskit (local, specialized)
 * 5. Frontier: GPT-5 (API, bleeding edge)
 *
 * Automatically enforces monthly budget limits and tracks spend.
 */

import {
  BaseModelRouter,
  InferenceRequest,
  RouteDecision,
  RoutingOptions,
} from '../core/model-router';
import { getCostTracker, CostTracker } from '../utils/cost-tracker';

export interface CostAwareRouterConfig {
  /** Monthly budget limit in USD */
  monthlyBudget: number;
  /** Default local model */
  defaultLocal?: string;
  /** Complexity threshold for API escalation (0-1) */
  complexityThreshold?: number;
  /** Token threshold for API escalation */
  tokenThreshold?: number;
  /** Custom cost tracker instance */
  costTracker?: CostTracker;
}

/**
 * Cost-aware router with budget enforcement
 */
export class CostAwareRouter extends BaseModelRouter {
  readonly name = 'cost-aware';
  private config: Required<Omit<CostAwareRouterConfig, 'costTracker'>> & {
    costTracker?: CostTracker;
  };
  private costTracker: CostTracker;

  constructor(config: CostAwareRouterConfig) {
    super();

    this.config = {
      monthlyBudget: config.monthlyBudget,
      defaultLocal: config.defaultLocal || 'qwen3-coder-30b',
      complexityThreshold: config.complexityThreshold ?? 0.8,
      tokenThreshold: config.tokenThreshold ?? 16000,
      costTracker: config.costTracker,
    };

    this.costTracker = config.costTracker || getCostTracker();
  }

  async route(request: InferenceRequest, options?: RoutingOptions): Promise<RouteDecision> {
    // Initialize cost tracker
    await this.costTracker.initialize();

    // Force overrides if specified
    if (options?.forceModel || options?.forceProvider) {
      return this.handleForcedRoute(request, options);
    }

    const tokens = request.estimatedTokens || 5000;
    const monthlySpend = await this.costTracker.getMonthlySpend();
    const budgetLimit = options?.budgetOverride ?? this.config.monthlyBudget;
    const remainingBudget = budgetLimit - monthlySpend;

    // Tier 4: Quantum-specific tasks (local specialized model)
    if (request.taskType === 'quantum') {
      return this.createLocalDecision(
        'ollama',
        'granite-8b-qiskit',
        '[Tier 4] Quantum task routed to specialized local model',
        tokens
      );
    }

    // Budget enforcement: Route to local if budget exceeded
    if (monthlySpend >= budgetLimit) {
      return this.createLocalDecision(
        'ollama',
        this.config.defaultLocal,
        `Budget limit reached ($${monthlySpend.toFixed(2)}/$${budgetLimit.toFixed(2)}) - routing to local`,
        tokens
      );
    }

    // Tier 5: Frontier reasoning for novel patterns (high complexity)
    if (request.complexity !== undefined && request.complexity >= this.config.complexityThreshold) {
      const pricing = this.getModelPricing('openai', 'gpt-5');
      const estimatedCost = this.estimateCost({ type: 'api', provider: 'openai', model: 'gpt-5' }, tokens, pricing);

      // Check if we have budget for this
      if (estimatedCost <= remainingBudget) {
        const decision = this.createAPIDecision(
          'openai',
          'gpt-5',
          `[Tier 5] High complexity (${(request.complexity * 100).toFixed(0)}%) requires frontier model`,
          tokens,
          pricing
        );

        // Add alternatives for explain mode
        if (options?.explain) {
          decision.alternatives = [
            this.createLocalDecision('ollama', 'llama-3.1-70b', '[Tier 2] Complex local fallback', tokens),
            this.createLocalDecision('ollama', this.config.defaultLocal, '[Tier 1] Default local', tokens),
          ];
        }

        return decision;
      } else {
        // Budget too low for GPT-5, fall back to local
        return this.createLocalDecision(
          'ollama',
          'llama-3.1-70b',
          `[Tier 2] Insufficient budget for GPT-5 (need $${estimatedCost.toFixed(2)}, have $${remainingBudget.toFixed(2)}) - using complex local`,
          tokens
        );
      }
    }

    // Tier 3: Large context requires Claude Opus 200K window
    if (tokens >= this.config.tokenThreshold) {
      const pricing = this.getModelPricing('anthropic', 'claude-opus-4');
      const estimatedCost = this.estimateCost(
        { type: 'api', provider: 'anthropic', model: 'claude-opus-4' },
        tokens,
        pricing
      );

      if (estimatedCost <= remainingBudget) {
        const decision = this.createAPIDecision(
          'anthropic',
          'claude-opus-4',
          `[Tier 3] Large context (${tokens.toLocaleString()} tokens) requires Claude Opus`,
          tokens,
          pricing
        );

        if (options?.explain) {
          decision.alternatives = [
            this.createLocalDecision('ollama', 'llama-3.1-70b', '[Tier 2] Local fallback (may exceed context)', tokens),
          ];
        }

        return decision;
      } else {
        // Budget too low, use local
        return this.createLocalDecision(
          'ollama',
          'llama-3.1-70b',
          `[Tier 2] Insufficient budget for Claude (need $${estimatedCost.toFixed(2)}, have $${remainingBudget.toFixed(2)}) - using local`,
          tokens
        );
      }
    }

    // Tier 1 & 2: Default to local (Qwen3 or Llama based on perceived complexity)
    if (tokens > 4000 || (request.complexity !== undefined && request.complexity > 0.5)) {
      // Slightly complex, use Llama
      const decision = this.createLocalDecision(
        'ollama',
        'llama-3.1-70b',
        '[Tier 2] Moderate complexity routed to Llama 3.1 70B (local)',
        tokens
      );

      if (options?.explain) {
        const claudePricing = this.getModelPricing('anthropic', 'claude-sonnet-4');
        decision.alternatives = [
          this.createAPIDecision('anthropic', 'claude-sonnet-4', '[Alternative] Claude Sonnet for higher quality', tokens, claudePricing),
          this.createLocalDecision('ollama', this.config.defaultLocal, '[Tier 1] Default local (faster)', tokens),
        ];
      }

      return decision;
    }

    // Tier 1: Daily driver (simple tasks)
    const decision = this.createLocalDecision(
      'ollama',
      this.config.defaultLocal,
      '[Tier 1] Daily driver for routine tasks',
      tokens
    );

    if (options?.explain) {
      const claudePricing = this.getModelPricing('anthropic', 'claude-sonnet-4');
      decision.alternatives = [
        this.createAPIDecision('anthropic', 'claude-sonnet-4', '[Alternative] Claude Sonnet for better quality', tokens, claudePricing),
      ];
    }

    return decision;
  }

  /**
   * Handle forced routing overrides
   */
  private handleForcedRoute(request: InferenceRequest, options: RoutingOptions): RouteDecision {
    const model = options.forceModel || this.config.defaultLocal;
    const provider = options.forceProvider || 'ollama';
    const tokens = request.estimatedTokens || 1000;

    if (provider === 'ollama') {
      return this.createLocalDecision(provider, model, 'User override: forced to local model', tokens);
    }

    const pricing = this.getModelPricing(provider, model);
    return this.createAPIDecision(provider, model, 'User override: forced to API', tokens, pricing);
  }

  /**
   * Get current monthly spend
   */
  async getMonthlySpend(): Promise<number> {
    await this.costTracker.initialize();
    return this.costTracker.getMonthlySpend();
  }

  /**
   * Get remaining budget for current month
   */
  async getRemainingBudget(): Promise<number> {
    const spent = await this.getMonthlySpend();
    return Math.max(0, this.config.monthlyBudget - spent);
  }
}
