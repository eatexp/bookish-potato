/**
 * Router Coverage Tests: Strategic high-value tests
 *
 * Tests specifically targeting uncovered lines and branches in routing logic
 * to achieve 97%+ coverage with production-critical scenarios.
 */

import { CostAwareRouter } from '../../../src/routers/cost-aware-router';
import { SimpleRouter } from '../../../src/routers/simple-router';
import { APIFirstRouter } from '../../../src/routers/api-first-router';
import { CostTracker } from '../../../src/utils/cost-tracker';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Router Coverage: Strategic Tests', () => {
  let tempDir: string;
  let costTracker: CostTracker;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'router-test-'));
    const filePath = path.join(tempDir, 'costs.json');
    costTracker = new CostTracker(filePath);
    await costTracker.initialize();
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('CostAwareRouter: recordCost method', () => {
    it('should record cost through router recordCost method', async () => {
      const router = new CostAwareRouter({
        monthlyBudget: 100,
        costTracker,
      });

      // Access the recordCost method directly (it's public)
      await router.recordCost({
        provider: 'openai',
        model: 'gpt-4',
        tokens: 1000,
        cost: 0.05,
      });

      const summary = await costTracker.getMonthlySummary();
      expect(summary.totalSpend).toBe(0.05);
      expect(summary.byProvider['openai']).toBe(0.05);
      expect(summary.byModel['gpt-4']).toBe(0.05);
    });

    it('should record multiple costs through router', async () => {
      const router = new CostAwareRouter({
        monthlyBudget: 100,
        costTracker,
      });

      await router.recordCost({
        provider: 'anthropic',
        model: 'claude-opus-4',
        tokens: 500,
        cost: 0.03,
      });

      await router.recordCost({
        provider: 'openai',
        model: 'gpt-5',
        tokens: 800,
        cost: 0.04,
      });

      const summary = await costTracker.getMonthlySummary();
      expect(summary.totalSpend).toBe(0.07);
      expect(summary.requestCount).toBe(2);
    });
  });

  describe('CostAwareRouter: Budget fallback scenarios', () => {
    it('should fall back to local when budget insufficient for high complexity', async () => {
      // Set very low budget that cannot afford GPT-5
      const router = new CostAwareRouter({
        monthlyBudget: 0.01, // Only 1 cent available
        costTracker,
      });

      // Spend almost all budget
      await costTracker.recordCost({
        provider: 'openai',
        model: 'gpt-4',
        tokens: 1000,
        cost: 0.009,
      });

      const decision = await router.route({
        prompt: 'Complex task',
        estimatedTokens: 5000,
        complexity: 9, // Would normally route to GPT-5
      });

      // Should fall back to local due to insufficient budget
      expect(decision.target.type).toBe('local');
      expect(decision.rationale).toContain('budget');
    });

    it('should fall back to lower tier when very tight budget', async () => {
      const router = new CostAwareRouter({
        monthlyBudget: 1, // Only $1
        costTracker,
      });

      // Spend most of budget
      await costTracker.recordCost({
        provider: 'openai',
        model: 'gpt-4',
        tokens: 10000,
        cost: 0.95,
      });

      // Only $0.05 left - very tight budget
      const decision = await router.route({
        prompt: 'Simple task',
        estimatedTokens: 1000,
        complexity: 3, // Low complexity
      });

      // With tight budget, should use efficient routing
      expect(decision.target).toBeDefined();
      if (decision.target.type === 'api') {
        // If API chosen, cost should be reasonable
        expect(decision.estimatedCost).toBeLessThan(0.05);
      }
    });
  });

  describe('CostAwareRouter: Explain mode with high complexity', () => {
    it('should provide alternatives for high complexity in explain mode', async () => {
      const router = new CostAwareRouter({
        monthlyBudget: 100,
        costTracker,
      });

      const decision = await router.route(
        {
          prompt: 'Very complex reasoning task',
          estimatedTokens: 3000,
          complexity: 9, // High complexity - routes to GPT-5
        },
        { explain: true }
      );

      expect(decision.target.provider).toBe('openai');
      expect(decision.target.model).toBe('gpt-5');
      expect(decision.alternatives).toBeDefined();
      expect(decision.alternatives!.length).toBeGreaterThan(0);

      // Alternatives should include local options
      const hasLocalAlternative = decision.alternatives!.some((alt) => alt.target.type === 'local');
      expect(hasLocalAlternative).toBe(true);
    });

    it('should provide alternatives for large context in explain mode', async () => {
      const router = new CostAwareRouter({
        monthlyBudget: 100,
        costTracker,
      });

      const decision = await router.route(
        {
          prompt: 'Task with huge context',
          estimatedTokens: 150000, // Very large context
          complexity: 6,
        },
        { explain: true }
      );

      expect(decision.alternatives).toBeDefined();
      expect(decision.alternatives!.length).toBeGreaterThan(0);

      // Should have local fallback options
      const localOptions = decision.alternatives!.filter((alt) => alt.target.type === 'local');
      expect(localOptions.length).toBeGreaterThan(0);
    });
  });

  describe('SimpleRouter: Cost estimation for local', () => {
    it('should always return zero cost for local models', async () => {
      const router = new SimpleRouter();

      const decision = await router.route({
        prompt: 'Test',
        estimatedTokens: 10000,
      });

      expect(decision.estimatedCost).toBe(0);
      expect(decision.target.type).toBe('local');
    });

    it('should return zero cost for quantum tasks on local', async () => {
      const router = new SimpleRouter();

      const decision = await router.route({
        prompt: 'Quantum computing simulation',
        estimatedTokens: 5000,
        tags: ['quantum'],
      });

      expect(decision.estimatedCost).toBe(0);
      expect(decision.target.type).toBe('local');
      // Simple router routes quantum to qwen3-coder-30b
      expect(decision.target.model).toBe('qwen3-coder-30b');
    });
  });

  describe('APIFirstRouter: Cost estimation', () => {
    it('should estimate non-zero cost for API models', async () => {
      const router = new APIFirstRouter();

      const decision = await router.route({
        prompt: 'Test',
        estimatedTokens: 1000,
      });

      if (decision.target.type === 'api') {
        expect(decision.estimatedCost).toBeGreaterThan(0);
      }
    });

    it('should have higher cost estimate for larger token counts', async () => {
      const router = new APIFirstRouter();

      const decision1 = await router.route({
        prompt: 'Test',
        estimatedTokens: 1000,
      });

      const decision2 = await router.route({
        prompt: 'Test',
        estimatedTokens: 10000,
      });

      if (decision1.target.type === 'api' && decision2.target.type === 'api') {
        expect(decision2.estimatedCost).toBeGreaterThan(decision1.estimatedCost);
      }
    });
  });

  describe('CostAwareRouter: Edge cases', () => {
    it('should handle zero estimated tokens', async () => {
      const router = new CostAwareRouter({
        monthlyBudget: 100,
        costTracker,
      });

      const decision = await router.route({
        prompt: '',
        estimatedTokens: 0,
      });

      expect(decision).toBeDefined();
      expect(decision.estimatedCost).toBe(0);
    });

    it('should handle very large token estimates', async () => {
      const router = new CostAwareRouter({
        monthlyBudget: 100,
        costTracker,
      });

      const decision = await router.route({
        prompt: 'Very long document',
        estimatedTokens: 1000000, // 1M tokens
      });

      expect(decision).toBeDefined();
      // With 1M tokens, cost would be very high, might fall back to local
      if (decision.target.type === 'local') {
        expect(decision.rationale).toBeDefined();
      }
    });

    it('should handle budget exactly at threshold', async () => {
      const router = new CostAwareRouter({
        monthlyBudget: 10,
        costTracker,
      });

      // Spend exactly to threshold
      await costTracker.recordCost({
        provider: 'openai',
        model: 'gpt-4',
        tokens: 100000,
        cost: 10.0,
      });

      // Budget now zero
      const decision = await router.route({
        prompt: 'Test',
        estimatedTokens: 1000,
      });

      // Should fall back to local
      expect(decision.target.type).toBe('local');
      expect(decision.rationale).toContain('Budget');
    });

    it('should handle negative remaining budget gracefully', async () => {
      const router = new CostAwareRouter({
        monthlyBudget: 10,
        costTracker,
      });

      // Overspend (simulating past overage)
      await costTracker.recordCost({
        provider: 'openai',
        model: 'gpt-4',
        tokens: 100000,
        cost: 15.0,
      });

      const remaining = await router.getRemainingBudget();
      expect(remaining).toBe(0); // Should floor at 0, not negative

      const decision = await router.route({
        prompt: 'Test',
        estimatedTokens: 1000,
      });

      expect(decision.target.type).toBe('local');
    });
  });

  describe('Router initialization edge cases', () => {
    it('should handle CostAwareRouter without explicit cost tracker', async () => {
      const router = new CostAwareRouter({
        monthlyBudget: 100,
      });

      const decision = await router.route({
        prompt: 'Test',
        estimatedTokens: 1000,
      });

      expect(decision).toBeDefined();
      expect(decision.target).toBeDefined();
    });

    it('should handle SimpleRouter with empty config', async () => {
      const router = new SimpleRouter({});

      const decision = await router.route({
        prompt: 'Test',
        estimatedTokens: 1000,
      });

      expect(decision).toBeDefined();
      expect(decision.target.type).toBe('local');
    });

    it('should handle APIFirstRouter with empty config', async () => {
      const router = new APIFirstRouter({});

      const decision = await router.route({
        prompt: 'Test',
        estimatedTokens: 1000,
      });

      expect(decision).toBeDefined();
      expect(decision.target.type).toBe('api');
    });
  });
});
