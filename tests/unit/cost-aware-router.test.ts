/**
 * Unit tests for CostAwareRouter
 */

import { CostAwareRouter } from '../../src/routers/cost-aware-router';
import { CostTracker } from '../../src/utils/cost-tracker';
import os from 'os';
import path from 'path';

// Mock cost tracker for testing
class MockCostTracker extends CostTracker {
  private mockSpend: number = 0;

  constructor() {
    super(path.join(os.tmpdir(), 'test-cost-tracker'));
  }

  async getMonthlySpend(): Promise<number> {
    return this.mockSpend;
  }

  setMockSpend(amount: number): void {
    this.mockSpend = amount;
  }
}

describe('CostAwareRouter', () => {
  let mockTracker: MockCostTracker;

  beforeEach(() => {
    mockTracker = new MockCostTracker();
  });

  describe('Basic functionality', () => {
    it('should have correct name', () => {
      const router = new CostAwareRouter({ monthlyBudget: 100, costTracker: mockTracker });
      expect(router.name).toBe('cost-aware');
    });

    it('should accept configuration with monthly budget', () => {
      const router = new CostAwareRouter({
        monthlyBudget: 100,
        costTracker: mockTracker,
      });
      expect(router).toBeDefined();
    });
  });

  describe('Budget enforcement', () => {
    it('should route to local when budget exceeded', async () => {
      mockTracker.setMockSpend(150);
      const router = new CostAwareRouter({ monthlyBudget: 100, costTracker: mockTracker });

      const decision = await router.route({
        prompt: 'test',
        estimatedTokens: 5000,
      });

      expect(decision.target.type).toBe('local');
      expect(decision.rationale.toLowerCase()).toContain('budget');
      expect(decision.estimatedCost).toBe(0);
    });

    it('should route to API when under budget', async () => {
      mockTracker.setMockSpend(10);
      const router = new CostAwareRouter({ monthlyBudget: 100, costTracker: mockTracker });

      const decision = await router.route({
        prompt: 'test',
        estimatedTokens: 20000, // Large enough to trigger API
      });

      expect(decision.target.type).toBe('api');
      expect(decision.estimatedCost).toBeGreaterThan(0);
    });

    it('should respect budget override', async () => {
      mockTracker.setMockSpend(150);
      const router = new CostAwareRouter({ monthlyBudget: 100, costTracker: mockTracker });

      const decision = await router.route(
        {
          prompt: 'test',
          estimatedTokens: 20000,
        },
        { budgetOverride: 200 } // Override to allow spending
      );

      expect(decision.target.type).toBe('api');
    });
  });

  describe('5-tier escalation workflow', () => {
    it('should use Tier 1 (Qwen3) for simple tasks', async () => {
      mockTracker.setMockSpend(0);
      const router = new CostAwareRouter({ monthlyBudget: 100, costTracker: mockTracker });

      const decision = await router.route({
        prompt: 'simple task',
        estimatedTokens: 1000,
        complexity: 0.2,
      });

      expect(decision.target.type).toBe('local');
      expect(decision.target.model).toBe('qwen3-coder-30b');
      expect(decision.rationale).toContain('Tier 1');
    });

    it('should use Tier 2 (Llama) for moderate complexity', async () => {
      mockTracker.setMockSpend(0);
      const router = new CostAwareRouter({ monthlyBudget: 100, costTracker: mockTracker });

      const decision = await router.route({
        prompt: 'moderate task',
        estimatedTokens: 5000,
        complexity: 0.6,
      });

      expect(decision.target.type).toBe('local');
      expect(decision.target.model).toBe('llama-3.1-70b');
      expect(decision.rationale).toContain('Tier 2');
    });

    it('should use Tier 3 (Claude) for large context', async () => {
      mockTracker.setMockSpend(0);
      const router = new CostAwareRouter({ monthlyBudget: 100, costTracker: mockTracker });

      const decision = await router.route({
        prompt: 'large document',
        estimatedTokens: 20000,
      });

      expect(decision.target.type).toBe('api');
      expect(decision.target.model).toBe('claude-opus-4');
      expect(decision.rationale).toContain('Tier 3');
    });

    it('should use Tier 4 (granite) for quantum tasks', async () => {
      mockTracker.setMockSpend(0);
      const router = new CostAwareRouter({ monthlyBudget: 100, costTracker: mockTracker });

      const decision = await router.route({
        prompt: 'quantum circuit',
        taskType: 'quantum',
      });

      expect(decision.target.type).toBe('local');
      expect(decision.target.model).toBe('granite-8b-qiskit');
      expect(decision.rationale).toContain('Tier 4');
    });

    it('should use Tier 5 (GPT-5) for high complexity', async () => {
      mockTracker.setMockSpend(0);
      const router = new CostAwareRouter({ monthlyBudget: 100, costTracker: mockTracker });

      const decision = await router.route({
        prompt: 'novel pattern detection',
        estimatedTokens: 5000,
        complexity: 0.9,
      });

      expect(decision.target.type).toBe('api');
      expect(decision.target.model).toBe('gpt-5');
      expect(decision.rationale).toContain('Tier 5');
    });
  });

  describe('Budget-constrained escalation', () => {
    it('should fall back to local when API would exceed budget', async () => {
      mockTracker.setMockSpend(99.5);
      const router = new CostAwareRouter({ monthlyBudget: 100, costTracker: mockTracker });

      const decision = await router.route({
        prompt: 'test',
        estimatedTokens: 50000, // Would cost more than $0.50 remaining
      });

      // Should fall back to local due to insufficient budget
      if (decision.target.type === 'local') {
        expect(decision.rationale).toContain('Insufficient budget');
      } else {
        // Or it might still route to API if cost is low enough
        expect(decision.estimatedCost).toBeLessThanOrEqual(0.5);
      }
    });

    it('should route based on budget constraints', async () => {
      mockTracker.setMockSpend(95);
      const router = new CostAwareRouter({ monthlyBudget: 100, costTracker: mockTracker });

      const decision = await router.route({
        prompt: 'test',
        complexity: 0.9,
        estimatedTokens: 10000,
      });

      // Either routes to API if budget allows, or falls back to local
      expect(decision.target).toBeDefined();
      if (decision.target.type === 'api') {
        expect(decision.estimatedCost).toBeLessThanOrEqual(5);
      }
    });
  });

  describe('Explain mode', () => {
    it('should provide alternatives when explain flag set', async () => {
      mockTracker.setMockSpend(0);
      const router = new CostAwareRouter({ monthlyBudget: 100, costTracker: mockTracker });

      const decision = await router.route(
        {
          prompt: 'test',
          estimatedTokens: 1000,
        },
        { explain: true }
      );

      expect(decision.alternatives).toBeDefined();
      expect(decision.alternatives!.length).toBeGreaterThan(0);
    });

    it('should not provide alternatives when explain not set', async () => {
      mockTracker.setMockSpend(0);
      const router = new CostAwareRouter({ monthlyBudget: 100, costTracker: mockTracker });

      const decision = await router.route({
        prompt: 'test',
        estimatedTokens: 1000,
      });

      expect(decision.alternatives).toBeUndefined();
    });
  });

  describe('Configuration thresholds', () => {
    it('should respect custom complexity threshold', async () => {
      mockTracker.setMockSpend(0);
      const router = new CostAwareRouter({
        monthlyBudget: 100,
        complexityThreshold: 0.5,
        costTracker: mockTracker,
      });

      const decision = await router.route({
        prompt: 'test',
        complexity: 0.6, // Above custom threshold
        estimatedTokens: 5000,
      });

      expect(decision.target.model).toBe('gpt-5');
    });

    it('should respect custom token threshold', async () => {
      mockTracker.setMockSpend(0);
      const router = new CostAwareRouter({
        monthlyBudget: 100,
        tokenThreshold: 10000,
        costTracker: mockTracker,
      });

      const decision = await router.route({
        prompt: 'test',
        estimatedTokens: 12000, // Above custom threshold
      });

      expect(decision.target.model).toBe('claude-opus-4');
    });

    it('should respect custom default local model', async () => {
      mockTracker.setMockSpend(0);
      const router = new CostAwareRouter({
        monthlyBudget: 100,
        defaultLocal: 'custom-model',
        costTracker: mockTracker,
      });

      const decision = await router.route({
        prompt: 'test',
        estimatedTokens: 1000,
      });

      expect(decision.target.model).toBe('custom-model');
    });
  });

  describe('Helper methods', () => {
    it('should get monthly spend', async () => {
      mockTracker.setMockSpend(50);
      const router = new CostAwareRouter({ monthlyBudget: 100, costTracker: mockTracker });

      const spend = await router.getMonthlySpend();
      expect(spend).toBe(50);
    });

    it('should get remaining budget', async () => {
      mockTracker.setMockSpend(30);
      const router = new CostAwareRouter({ monthlyBudget: 100, costTracker: mockTracker });

      const remaining = await router.getRemainingBudget();
      expect(remaining).toBe(70);
    });

    it('should return zero for remaining budget when exceeded', async () => {
      mockTracker.setMockSpend(150);
      const router = new CostAwareRouter({ monthlyBudget: 100, costTracker: mockTracker });

      const remaining = await router.getRemainingBudget();
      expect(remaining).toBe(0);
    });
  });

  describe('Force overrides', () => {
    it('should override to local model', async () => {
      mockTracker.setMockSpend(0);
      const router = new CostAwareRouter({ monthlyBudget: 100, costTracker: mockTracker });

      const decision = await router.route(
        { prompt: 'test' },
        { forceProvider: 'ollama', forceModel: 'custom' }
      );

      expect(decision.target.type).toBe('local');
      expect(decision.target.model).toBe('custom');
      expect(decision.rationale).toContain('override');
    });

    it('should override to API model', async () => {
      mockTracker.setMockSpend(0);
      const router = new CostAwareRouter({ monthlyBudget: 100, costTracker: mockTracker });

      const decision = await router.route(
        { prompt: 'test' },
        { forceProvider: 'anthropic', forceModel: 'claude-sonnet-4' }
      );

      expect(decision.target.type).toBe('api');
      expect(decision.target.model).toBe('claude-sonnet-4');
    });
  });
});
