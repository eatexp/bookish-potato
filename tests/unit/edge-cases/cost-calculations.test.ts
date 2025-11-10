/**
 * Edge Case Tests: Cost Calculations
 *
 * Tests boundary conditions, precision, and edge cases in cost tracking
 * and calculations across routers and cost tracker.
 */

import { CostTracker } from '../../../src/utils/cost-tracker';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Edge Cases: Cost Calculations', () => {
  let tempDir: string;
  let costTracker: CostTracker;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cost-test-'));
    const filePath = path.join(tempDir, 'costs.json');
    costTracker = new CostTracker(filePath);
    await costTracker.initialize();
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('Floating-point precision', () => {
    it('should handle very small costs (micro-cents)', async () => {
      // Cost: $0.0000001 (0.1 micro-cents)
      await costTracker.recordCost({
        provider: 'test',
        model: 'tiny-model',
        tokens: 1,
        cost: 0.0000001,
      });

      const summary = await costTracker.getMonthlySummary();
      expect(summary.totalSpend).toBeCloseTo(0.0000001, 10);
    });

    it('should accumulate small costs without precision loss', async () => {
      // Add 1000 micro-costs
      for (let i = 0; i < 1000; i++) {
        await costTracker.recordCost({
          provider: 'test',
          model: 'micro',
          tokens: 1,
          cost: 0.000001, // 1 micro-cent each
        });
      }

      const summary = await costTracker.getMonthlySummary();
      // 1000 * 0.000001 = 0.001
      expect(summary.totalSpend).toBeCloseTo(0.001, 6);
    });

    it('should handle costs near rounding boundaries', async () => {
      await costTracker.recordCost({
        provider: 'test',
        model: 'boundary',
        tokens: 100,
        cost: 0.499999, // Just under 0.5
      });

      await costTracker.recordCost({
        provider: 'test',
        model: 'boundary',
        tokens: 100,
        cost: 0.500001, // Just over 0.5
      });

      const summary = await costTracker.getMonthlySummary();
      expect(summary.totalSpend).toBeCloseTo(1.0, 5);
    });

    it('should handle repeating decimals', async () => {
      // 1/3 = 0.333...
      await costTracker.recordCost({
        provider: 'test',
        model: 'repeating',
        tokens: 1,
        cost: 1 / 3,
      });

      const summary = await costTracker.getMonthlySummary();
      expect(summary.totalSpend).toBeCloseTo(0.333333, 5);
    });
  });

  describe('Zero and boundary values', () => {
    it('should handle zero cost requests', async () => {
      await costTracker.recordCost({
        provider: 'local',
        model: 'free-model',
        tokens: 1000,
        cost: 0,
      });

      const summary = await costTracker.getMonthlySummary();
      expect(summary.totalSpend).toBe(0);
      expect(summary.requestCount).toBe(1);
    });

    it('should handle zero token requests', async () => {
      await costTracker.recordCost({
        provider: 'test',
        model: 'zero-tokens',
        tokens: 0,
        cost: 0.01,
      });

      const summary = await costTracker.getMonthlySummary();
      expect(summary.totalSpend).toBe(0.01);
      expect(summary.totalTokens).toBe(0);
    });

    it('should handle maximum safe integer tokens', async () => {
      const maxTokens = Number.MAX_SAFE_INTEGER;

      await costTracker.recordCost({
        provider: 'test',
        model: 'huge',
        tokens: maxTokens,
        cost: 100,
      });

      const summary = await costTracker.getMonthlySummary();
      expect(summary.totalTokens).toBe(maxTokens);
    });
  });

  describe('Large numbers', () => {
    it('should handle very large token counts', async () => {
      // 1 billion tokens
      await costTracker.recordCost({
        provider: 'test',
        model: 'large-context',
        tokens: 1_000_000_000,
        cost: 1000,
      });

      const summary = await costTracker.getMonthlySummary();
      expect(summary.totalTokens).toBe(1_000_000_000);
      expect(summary.totalSpend).toBe(1000);
    });

    it('should handle very large costs', async () => {
      // $10,000 request (expensive!)
      await costTracker.recordCost({
        provider: 'expensive-api',
        model: 'premium',
        tokens: 100_000,
        cost: 10_000,
      });

      const summary = await costTracker.getMonthlySummary();
      expect(summary.totalSpend).toBe(10_000);
    });

    it('should accumulate many requests efficiently', async () => {
      // Add 1,000 requests (reduced from 10,000 for performance)
      for (let i = 0; i < 1_000; i++) {
        await costTracker.recordCost({
          provider: 'test',
          model: 'batch',
          tokens: 100,
          cost: 0.01,
        });
      }

      const summary = await costTracker.getMonthlySummary();
      expect(summary.requestCount).toBe(1_000);
      expect(summary.totalTokens).toBe(100_000);
      expect(summary.totalSpend).toBeCloseTo(10, 2);
    });
  });

  describe('Cost aggregation', () => {
    it('should correctly aggregate costs by provider', async () => {
      await costTracker.recordCost({
        provider: 'anthropic',
        model: 'claude-opus',
        tokens: 1000,
        cost: 0.05,
      });

      await costTracker.recordCost({
        provider: 'anthropic',
        model: 'claude-sonnet',
        tokens: 2000,
        cost: 0.02,
      });

      await costTracker.recordCost({
        provider: 'openai',
        model: 'gpt-4',
        tokens: 1000,
        cost: 0.03,
      });

      const summary = await costTracker.getMonthlySummary();

      expect(summary.byProvider.anthropic).toBeCloseTo(0.07, 5);
      expect(summary.byProvider.openai).toBeCloseTo(0.03, 5);
    });

    it('should correctly aggregate costs by model', async () => {
      await costTracker.recordCost({
        provider: 'anthropic',
        model: 'claude-opus',
        tokens: 1000,
        cost: 0.05,
      });

      await costTracker.recordCost({
        provider: 'anthropic',
        model: 'claude-opus',
        tokens: 1000,
        cost: 0.05,
      });

      const summary = await costTracker.getMonthlySummary();

      expect(summary.byModel['claude-opus']).toBeCloseTo(0.1, 5);
    });

    it('should handle mixed positive costs correctly', async () => {
      const costs = [0.001, 0.002, 0.003, 0.004, 0.005];

      for (const cost of costs) {
        await costTracker.recordCost({
          provider: 'test',
          model: 'mixed',
          tokens: 100,
          cost,
        });
      }

      const summary = await costTracker.getMonthlySummary();
      // Sum: 0.015
      expect(summary.totalSpend).toBeCloseTo(0.015, 5);
    });
  });

  describe('Monthly boundary conditions', () => {
    it('should correctly calculate costs for month boundary', async () => {
      // This test just ensures monthly aggregation works
      await costTracker.recordCost({
        provider: 'test',
        model: 'monthly-test',
        tokens: 1000,
        cost: 10,
      });

      const thisMonth = await costTracker.getMonthlySummary();
      expect(thisMonth.totalSpend).toBe(10);
    });

    it('should handle empty cost history', async () => {
      const summary = await costTracker.getMonthlySummary();

      expect(summary.totalSpend).toBe(0);
      expect(summary.requestCount).toBe(0);
      expect(summary.totalTokens).toBe(0);
    });
  });

  describe('Currency rounding edge cases', () => {
    it('should handle 0.001 cent costs', async () => {
      await costTracker.recordCost({
        provider: 'test',
        model: 'tiny',
        tokens: 1,
        cost: 0.00001, // 0.001 cents
      });

      const summary = await costTracker.getMonthlySummary();
      expect(summary.totalSpend).toBeCloseTo(0.00001, 8);
    });

    it('should handle 0.999 costs (near dollar)', async () => {
      await costTracker.recordCost({
        provider: 'test',
        model: 'near-dollar',
        tokens: 1000,
        cost: 0.999,
      });

      await costTracker.recordCost({
        provider: 'test',
        model: 'near-dollar',
        tokens: 1000,
        cost: 0.999,
      });

      const summary = await costTracker.getMonthlySummary();
      expect(summary.totalSpend).toBeCloseTo(1.998, 5);
    });

    it('should handle exact dollar amounts', async () => {
      await costTracker.recordCost({
        provider: 'test',
        model: 'exact',
        tokens: 1000,
        cost: 1.0,
      });

      await costTracker.recordCost({
        provider: 'test',
        model: 'exact',
        tokens: 1000,
        cost: 5.0,
      });

      const summary = await costTracker.getMonthlySummary();
      expect(summary.totalSpend).toBe(6.0);
    });
  });

  describe('Cost persistence edge cases', () => {
    it('should persist costs across multiple initializations', async () => {
      const filePath = path.join(tempDir, 'persistent-costs.json');

      // First tracker instance
      const tracker1 = new CostTracker(filePath);
      await tracker1.initialize();
      await tracker1.recordCost({
        provider: 'test',
        model: 'persistent',
        tokens: 100,
        cost: 1.0,
      });

      // Second tracker instance (should load existing data)
      const tracker2 = new CostTracker(filePath);
      await tracker2.initialize();
      const summary = await tracker2.getMonthlySummary();

      expect(summary.totalSpend).toBe(1.0);
      expect(summary.requestCount).toBe(1);
    });

    it('should handle concurrent cost additions', async () => {
      // Simulate concurrent requests
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          costTracker.recordCost({
            provider: 'test',
            model: 'concurrent',
            tokens: 100,
            cost: 0.1,
          })
        );
      }

      await Promise.all(promises);

      const summary = await costTracker.getMonthlySummary();
      expect(summary.requestCount).toBe(10);
      expect(summary.totalSpend).toBeCloseTo(1.0, 5);
    });
  });

  describe('Statistical edge cases', () => {
    it('should calculate average cost correctly for single request', async () => {
      await costTracker.recordCost({
        provider: 'test',
        model: 'single',
        tokens: 100,
        cost: 0.5,
      });

      const summary = await costTracker.getMonthlySummary();
      const avgCost = summary.totalSpend / summary.requestCount;

      expect(avgCost).toBe(0.5);
    });

    it('should calculate average tokens correctly', async () => {
      await costTracker.recordCost({
        provider: 'test',
        model: 'avg-test',
        tokens: 100,
        cost: 0.1,
      });

      await costTracker.recordCost({
        provider: 'test',
        model: 'avg-test',
        tokens: 200,
        cost: 0.2,
      });

      await costTracker.recordCost({
        provider: 'test',
        model: 'avg-test',
        tokens: 300,
        cost: 0.3,
      });

      const summary = await costTracker.getMonthlySummary();
      const avgTokens = summary.totalTokens / summary.requestCount;

      expect(avgTokens).toBe(200); // (100 + 200 + 300) / 3
    });
  });
});
