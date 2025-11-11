/**
 * Branch Coverage Tests for BaseModelRouter
 *
 * Targets uncovered branches in model-router.ts to improve branch coverage
 * from 55.55% to 85%+. Focuses on conditional logic and edge cases.
 */

import {
  BaseModelRouter,
  InferenceRequest,
  RoutingOptions,
  RouteDecision,
  ModelTarget,
  ModelPricing,
} from '../../../src/core/model-router';

// Concrete implementation of BaseModelRouter for testing
class TestRouter extends BaseModelRouter {
  readonly name = 'test-router';

  async route(request: InferenceRequest, options?: RoutingOptions): Promise<RouteDecision> {
    const tokens = request.estimatedTokens || 1000;

    if (options?.forceProvider === 'local') {
      return this.createLocalDecision('ollama', 'llama2', 'Forced local', tokens);
    }

    if (request.complexity && request.complexity > 0.7) {
      const pricing: ModelPricing = {
        inputCostPerMToken: 15,
        outputCostPerMToken: 75,
        latencyPerKToken: 2.5,
      };
      return this.createAPIDecision('anthropic', 'claude-opus-4', 'High complexity', tokens, pricing);
    }

    return this.createLocalDecision('ollama', 'llama2', 'Default local', tokens);
  }

  // Expose protected methods for testing
  public testEstimateCost(target: ModelTarget, tokens: number, pricing: ModelPricing): number {
    return this.estimateCost(target, tokens, pricing);
  }

  public testEstimateLatency(target: ModelTarget, tokens: number, pricing: ModelPricing): number {
    return this.estimateLatency(target, tokens, pricing);
  }

  public testGetModelPricing(provider: string, model: string): ModelPricing {
    return this.getModelPricing(provider, model);
  }

  public testCreateLocalDecision(
    provider: string,
    model: string,
    rationale: string,
    tokens?: number,
    pricing?: ModelPricing
  ): RouteDecision {
    return this.createLocalDecision(provider, model, rationale, tokens, pricing);
  }

  public testCreateAPIDecision(
    provider: string,
    model: string,
    rationale: string,
    tokens: number,
    pricing: ModelPricing
  ): RouteDecision {
    return this.createAPIDecision(provider, model, rationale, tokens, pricing);
  }
}

describe('BaseModelRouter: Branch Coverage Tests', () => {
  let router: TestRouter;

  beforeEach(() => {
    router = new TestRouter();
  });

  describe('estimateCost() - API path', () => {
    it('should calculate cost for API target with known pricing', () => {
      const target: ModelTarget = {
        type: 'api',
        provider: 'anthropic',
        model: 'claude-opus-4',
      };

      const pricing: ModelPricing = {
        inputCostPerMToken: 15, // $15 per 1M input tokens
        outputCostPerMToken: 75, // $75 per 1M output tokens
        latencyPerKToken: 2.5,
      };

      // 1000 tokens: 670 input, 330 output
      const cost = router.testEstimateCost(target, 1000, pricing);

      // Expected: (670/1M * 15) + (330/1M * 75) = 0.01005 + 0.02475 = 0.0348
      expect(cost).toBeCloseTo(0.0348, 4);
    });

    it('should calculate cost for API target with large token count', () => {
      const target: ModelTarget = {
        type: 'api',
        provider: 'openai',
        model: 'gpt-5',
      };

      const pricing: ModelPricing = {
        inputCostPerMToken: 20,
        outputCostPerMToken: 100,
        latencyPerKToken: 3.0,
      };

      // 100,000 tokens: 67,000 input, 33,000 output
      const cost = router.testEstimateCost(target, 100_000, pricing);

      // Expected: (67000/1M * 20) + (33000/1M * 100) = 1.34 + 3.3 = 4.64
      expect(cost).toBeCloseTo(4.64, 2);
    });

    it('should calculate cost for API target with asymmetric pricing', () => {
      const target: ModelTarget = {
        type: 'api',
        provider: 'openai',
        model: 'gpt-4-turbo',
      };

      const pricing: ModelPricing = {
        inputCostPerMToken: 10,
        outputCostPerMToken: 30,
        latencyPerKToken: 2.0,
      };

      const cost = router.testEstimateCost(target, 5000, pricing);

      // Expected: (3350/1M * 10) + (1650/1M * 30) = 0.0335 + 0.0495 = 0.083
      expect(cost).toBeCloseTo(0.083, 3);
    });

    it('should return 0 cost for local target', () => {
      const target: ModelTarget = {
        type: 'local',
        provider: 'ollama',
        model: 'llama2',
      };

      const pricing: ModelPricing = {
        inputCostPerMToken: 0,
        outputCostPerMToken: 0,
        latencyPerKToken: 0.067,
      };

      const cost = router.testEstimateCost(target, 10000, pricing);
      expect(cost).toBe(0);
    });
  });

  describe('estimateLatency() - API path', () => {
    it('should estimate latency for API target with default latency', () => {
      const target: ModelTarget = {
        type: 'api',
        provider: 'anthropic',
        model: 'claude-sonnet-4',
      };

      const pricing: ModelPricing = {
        inputCostPerMToken: 3,
        outputCostPerMToken: 15,
        latencyPerKToken: 1.5, // 1.5s per 1K tokens
      };

      const latency = router.testEstimateLatency(target, 2000, pricing);

      // Expected: (2000 / 1000) * 1.5 = 3.0 seconds
      expect(latency).toBe(3.0);
    });

    it('should estimate latency for API target without latencyPerKToken (use default)', () => {
      const target: ModelTarget = {
        type: 'api',
        provider: 'openai',
        model: 'gpt-5',
      };

      const pricing: ModelPricing = {
        inputCostPerMToken: 20,
        outputCostPerMToken: 100,
        // latencyPerKToken omitted - should use default 2.0
      };

      const latency = router.testEstimateLatency(target, 5000, pricing);

      // Expected: (5000 / 1000) * 2.0 = 10.0 seconds (default)
      expect(latency).toBe(10.0);
    });

    it('should estimate latency for API target with high latency', () => {
      const target: ModelTarget = {
        type: 'api',
        provider: 'openai',
        model: 'gpt-5',
      };

      const pricing: ModelPricing = {
        inputCostPerMToken: 20,
        outputCostPerMToken: 100,
        latencyPerKToken: 5.0, // Slow model
      };

      const latency = router.testEstimateLatency(target, 10000, pricing);

      // Expected: (10000 / 1000) * 5.0 = 50.0 seconds
      expect(latency).toBe(50.0);
    });

    it('should estimate latency for local target', () => {
      const target: ModelTarget = {
        type: 'local',
        provider: 'ollama',
        model: 'qwen3-coder-30b',
      };

      const pricing: ModelPricing = {
        inputCostPerMToken: 0,
        outputCostPerMToken: 0,
        latencyPerKToken: 0.067, // Ignored for local
      };

      const latency = router.testEstimateLatency(target, 3000, pricing);

      // Expected: (3000 / 15) / 1000 = 0.2 seconds
      expect(latency).toBeCloseTo(0.2, 3);
    });
  });

  describe('getModelPricing() - unknown model fallback', () => {
    it('should return default pricing for unknown model', () => {
      const pricing = router.testGetModelPricing('custom-provider', 'unknown-model-xyz');

      expect(pricing.inputCostPerMToken).toBe(5);
      expect(pricing.outputCostPerMToken).toBe(15);
      expect(pricing.latencyPerKToken).toBe(2.0);
    });

    it('should return correct pricing for claude-opus-4', () => {
      const pricing = router.testGetModelPricing('anthropic', 'claude-opus-4');

      expect(pricing.inputCostPerMToken).toBe(15);
      expect(pricing.outputCostPerMToken).toBe(75);
      expect(pricing.latencyPerKToken).toBe(2.5);
    });

    it('should return correct pricing for gpt-5', () => {
      const pricing = router.testGetModelPricing('openai', 'gpt-5');

      expect(pricing.inputCostPerMToken).toBe(20);
      expect(pricing.outputCostPerMToken).toBe(100);
      expect(pricing.latencyPerKToken).toBe(3.0);
    });

    it('should return correct pricing for local qwen3-coder-30b', () => {
      const pricing = router.testGetModelPricing('ollama', 'qwen3-coder-30b');

      expect(pricing.inputCostPerMToken).toBe(0);
      expect(pricing.outputCostPerMToken).toBe(0);
      expect(pricing.latencyPerKToken).toBe(0.067);
    });
  });

  describe('createLocalDecision() - with custom pricing', () => {
    it('should create local decision with default pricing when not provided', () => {
      const decision = router.testCreateLocalDecision('ollama', 'llama2', 'Test decision', 2000);

      expect(decision.target.type).toBe('local');
      expect(decision.target.provider).toBe('ollama');
      expect(decision.target.model).toBe('llama2');
      expect(decision.estimatedCost).toBe(0);
      expect(decision.rationale).toBe('Test decision');
      expect(decision.confidence).toBe(0.9);
      expect(decision.estimatedLatency).toBeGreaterThan(0);
    });

    it('should create local decision with custom pricing provided', () => {
      const customPricing: ModelPricing = {
        inputCostPerMToken: 0,
        outputCostPerMToken: 0,
        latencyPerKToken: 0.1, // Slower than default
      };

      const decision = router.testCreateLocalDecision(
        'ollama',
        'llama-3.1-70b',
        'Large model',
        5000,
        customPricing
      );

      expect(decision.target.type).toBe('local');
      expect(decision.target.model).toBe('llama-3.1-70b');
      expect(decision.estimatedCost).toBe(0);
      // Latency should use custom pricing: (5000 / 15) / 1000
      expect(decision.estimatedLatency).toBeCloseTo(0.333, 3);
    });

    it('should create local decision with default token count when not provided', () => {
      const decision = router.testCreateLocalDecision('ollama', 'granite-8b-qiskit', 'Quantum task');

      expect(decision.target.type).toBe('local');
      expect(decision.target.model).toBe('granite-8b-qiskit');
      expect(decision.estimatedCost).toBe(0);
      // Should use default 1000 tokens
      expect(decision.estimatedLatency).toBeGreaterThan(0);
      expect(decision.estimatedLatency).toBeLessThan(1);
    });
  });

  describe('createAPIDecision() - variations', () => {
    it('should create API decision for Anthropic Claude Opus', () => {
      const pricing: ModelPricing = {
        inputCostPerMToken: 15,
        outputCostPerMToken: 75,
        latencyPerKToken: 2.5,
      };

      const decision = router.testCreateAPIDecision(
        'anthropic',
        'claude-opus-4',
        'Complex reasoning',
        10000,
        pricing
      );

      expect(decision.target.type).toBe('api');
      expect(decision.target.provider).toBe('anthropic');
      expect(decision.target.model).toBe('claude-opus-4');
      expect(decision.estimatedCost).toBeGreaterThan(0);
      expect(decision.rationale).toBe('Complex reasoning');
      expect(decision.confidence).toBe(0.85);
      expect(decision.estimatedLatency).toBeGreaterThan(0);
    });

    it('should create API decision for OpenAI GPT-5', () => {
      const pricing: ModelPricing = {
        inputCostPerMToken: 20,
        outputCostPerMToken: 100,
        latencyPerKToken: 3.0,
      };

      const decision = router.testCreateAPIDecision(
        'openai',
        'gpt-5',
        'Advanced analysis',
        50000,
        pricing
      );

      expect(decision.target.type).toBe('api');
      expect(decision.target.provider).toBe('openai');
      expect(decision.target.model).toBe('gpt-5');
      expect(decision.estimatedCost).toBeGreaterThan(1); // Large token count
      expect(decision.rationale).toBe('Advanced analysis');
      expect(decision.confidence).toBe(0.85);
    });

    it('should create API decision with minimal tokens', () => {
      const pricing: ModelPricing = {
        inputCostPerMToken: 3,
        outputCostPerMToken: 15,
        latencyPerKToken: 1.5,
      };

      const decision = router.testCreateAPIDecision(
        'anthropic',
        'claude-sonnet-4',
        'Quick task',
        100,
        pricing
      );

      expect(decision.target.type).toBe('api');
      expect(decision.estimatedCost).toBeLessThan(0.01); // Very small cost
      expect(decision.estimatedLatency).toBeLessThan(1); // Very fast
    });
  });

  describe('Integration: route() method with branches', () => {
    it('should route to local when forceProvider is local', async () => {
      const request: InferenceRequest = {
        prompt: 'Test prompt',
        estimatedTokens: 2000,
        complexity: 0.9, // High complexity, but forced local
      };

      const decision = await router.route(request, { forceProvider: 'local' });

      expect(decision.target.type).toBe('local');
      expect(decision.rationale).toContain('Forced local');
    });

    it('should route to API for high complexity', async () => {
      const request: InferenceRequest = {
        prompt: 'Complex reasoning task',
        estimatedTokens: 5000,
        complexity: 0.8,
      };

      const decision = await router.route(request);

      expect(decision.target.type).toBe('api');
      expect(decision.target.provider).toBe('anthropic');
      expect(decision.rationale).toContain('High complexity');
    });

    it('should route to local for low complexity', async () => {
      const request: InferenceRequest = {
        prompt: 'Simple task',
        estimatedTokens: 1000,
        complexity: 0.3,
      };

      const decision = await router.route(request);

      expect(decision.target.type).toBe('local');
      expect(decision.rationale).toContain('Default local');
    });
  });
});
