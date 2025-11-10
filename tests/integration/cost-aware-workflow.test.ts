/**
 * Integration test: Cost-Aware Router with Budget Tracking
 *
 * Tests the complete workflow of budget-aware routing with persistent
 * cost tracking across multiple API calls.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CostAwareRouter } from '../../src/routers/cost-aware-router';
import { CostTracker } from '../../src/utils/cost-tracker';
import { AnthropicProvider } from '../../src/providers/anthropic-provider';
import { OpenAIProvider } from '../../src/providers/openai-provider';

// Mock fetch for API calls
global.fetch = jest.fn();

describe('Integration: Cost-Aware Router with Budget Tracking', () => {
  let router: CostAwareRouter;
  let costTracker: CostTracker;
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for cost tracking
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cost-test-'));

    // Create dedicated cost tracker
    costTracker = new CostTracker(path.join(tempDir, 'costs.json'));
    await costTracker.initialize();

    // Create router with cost tracker
    router = new CostAwareRouter({
      monthlyBudget: 50.0, // $50 budget for testing
      defaultLocal: 'qwen3-coder-30b',
      complexityThreshold: 0.8,
      tokenThreshold: 16000,
      costTracker: costTracker,
    });
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('Budget enforcement workflow', () => {
    it('should track costs across multiple API calls', async () => {
      // Initial budget check
      const initialSpend = await router.getMonthlySpend();
      expect(initialSpend).toBe(0);

      // Step 1: Route high complexity task (should use API)
      const decision1 = await router.route({
        prompt: 'Design a novel consensus algorithm',
        estimatedTokens: 5000,
        complexity: 0.9,
      });

      expect(decision1.target.provider).toBe('openai');
      expect(decision1.target.model).toBe('gpt-5');
      expect(decision1.estimatedCost).toBeGreaterThan(0);
      const cost1 = decision1.estimatedCost;

      // Simulate recording cost after successful execution
      await costTracker.recordCost({
        provider: 'openai',
        model: 'gpt-5',
        promptTokens: 200,
        completionTokens: 300,
        totalTokens: 500,
        cost: cost1,
      });

      // Step 2: Check updated spend
      const spend1 = await router.getMonthlySpend();
      expect(spend1).toBe(cost1);
      expect(spend1).toBeGreaterThan(0);

      // Step 3: Route another high complexity task
      const decision2 = await router.route({
        prompt: 'Implement distributed tracing',
        estimatedTokens: 6000,
        complexity: 0.85,
      });

      expect(decision2.target.provider).toBe('openai');
      const cost2 = decision2.estimatedCost;

      await costTracker.recordCost({
        provider: 'openai',
        model: 'gpt-5',
        promptTokens: 250,
        completionTokens: 400,
        totalTokens: 650,
        cost: cost2,
      });

      // Step 4: Verify cumulative spend
      const spend2 = await router.getMonthlySpend();
      expect(spend2).toBe(cost1 + cost2);

      // Step 5: Check remaining budget
      const remaining = await router.getRemainingBudget();
      expect(remaining).toBe(50.0 - (cost1 + cost2));
    });

    it('should fall back to local when budget exceeded', async () => {
      // Simulate existing spend at budget limit
      await costTracker.recordCost({
        provider: 'anthropic',
        model: 'claude-opus-4',
        promptTokens: 10000,
        completionTokens: 5000,
        totalTokens: 15000,
        cost: 50.0, // Exactly at $50 limit
      });

      const currentSpend = await router.getMonthlySpend();
      expect(currentSpend).toBe(50.0);

      // Try to route a high complexity task
      const decision = await router.route({
        prompt: 'Complex architectural design',
        estimatedTokens: 5000,
        complexity: 0.95,
      });

      // Should fall back to local despite high complexity
      expect(decision.target.type).toBe('local');
      expect(decision.target.provider).toBe('ollama');
      expect(decision.rationale).toContain('Budget limit reached');
      expect(decision.estimatedCost).toBe(0);
    });

    it('should allow API usage when sufficient budget remains', async () => {
      // Record some prior spend
      await costTracker.recordCost({
        provider: 'anthropic',
        model: 'claude-sonnet-4',
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
        cost: 5.0,
      });

      const spend = await router.getMonthlySpend();
      expect(spend).toBe(5.0);

      // Route large context task (should use Claude Opus)
      const decision = await router.route({
        prompt: 'Summarize this large document',
        estimatedTokens: 20000,
      });

      expect(decision.target.provider).toBe('anthropic');
      expect(decision.target.model).toBe('claude-opus-4');
      expect(decision.estimatedCost).toBeGreaterThan(0);
      expect(decision.estimatedCost).toBeLessThan(45.0); // Within remaining budget
    });
  });

  describe('5-tier escalation with budget constraints', () => {
    it('should escalate through tiers based on complexity and budget', async () => {
      // Tier 1: Simple task
      const tier1 = await router.route({
        prompt: 'Format JSON',
        estimatedTokens: 200,
        complexity: 0.1,
      });
      expect(tier1.target.model).toBe('qwen3-coder-30b');
      expect(tier1.rationale).toContain('Tier 1');

      // Tier 2: Moderate complexity
      const tier2 = await router.route({
        prompt: 'Implement binary search',
        estimatedTokens: 1000,
        complexity: 0.6,
      });
      expect(tier2.target.model).toBe('llama-3.1-70b');
      expect(tier2.rationale).toContain('Tier 2');

      // Tier 3: Large context (under budget)
      const tier3 = await router.route({
        prompt: 'Analyze large codebase',
        estimatedTokens: 25000,
      });
      expect(tier3.target.provider).toBe('anthropic');
      expect(tier3.target.model).toBe('claude-opus-4');
      expect(tier3.rationale).toContain('Tier 3');

      // Tier 4: Quantum task
      const tier4 = await router.route({
        prompt: 'Optimize quantum circuit',
        estimatedTokens: 1000,
        taskType: 'quantum',
      });
      expect(tier4.target.model).toBe('granite-8b-qiskit');
      expect(tier4.rationale).toContain('Tier 4');

      // Tier 5: Highest complexity (under budget)
      const tier5 = await router.route({
        prompt: 'Novel distributed algorithm',
        estimatedTokens: 3000,
        complexity: 0.95,
      });
      expect(tier5.target.provider).toBe('openai');
      expect(tier5.target.model).toBe('gpt-5');
      expect(tier5.rationale).toContain('Tier 5');
    });

    it('should provide alternatives in explain mode', async () => {
      const decision = await router.route(
        {
          prompt: 'Moderate task',
          estimatedTokens: 2000,
          complexity: 0.6,
        },
        {
          explain: true,
        }
      );

      expect(decision.target.model).toBe('llama-3.1-70b');
      expect(decision.alternatives).toBeDefined();
      expect(decision.alternatives!.length).toBeGreaterThan(0);

      // Verify alternatives include API options
      const hasAPIAlternative = decision.alternatives!.some(
        (alt) => alt.target.type === 'api'
      );
      expect(hasAPIAlternative).toBe(true);
    });
  });

  describe('Cost tracking persistence', () => {
    it('should persist costs across router instances', async () => {
      // Record cost with first router instance
      await costTracker.recordCost({
        provider: 'anthropic',
        model: 'claude-opus-4',
        promptTokens: 500,
        completionTokens: 300,
        totalTokens: 800,
        cost: 10.5,
      });

      const spend1 = await router.getMonthlySpend();
      expect(spend1).toBe(10.5);

      // Create new router instance with same cost tracker file
      const newCostTracker = new CostTracker(path.join(tempDir, 'costs.json'));
      await newCostTracker.initialize();

      const newRouter = new CostAwareRouter({
        monthlyBudget: 50.0,
        costTracker: newCostTracker,
      });

      // Should see same spend
      const spend2 = await newRouter.getMonthlySpend();
      expect(spend2).toBe(10.5);

      // Add more spend
      await newCostTracker.recordCost({
        provider: 'openai',
        model: 'gpt-5',
        promptTokens: 300,
        completionTokens: 200,
        totalTokens: 500,
        cost: 5.25,
      });

      const spend3 = await newRouter.getMonthlySpend();
      expect(spend3).toBe(15.75);
    });

    it('should export and verify cost history', async () => {
      // Record multiple costs
      await costTracker.recordCost({
        provider: 'anthropic',
        model: 'claude-opus-4',
        promptTokens: 500,
        completionTokens: 300,
        totalTokens: 800,
        cost: 8.5,
      });

      await costTracker.recordCost({
        provider: 'openai',
        model: 'gpt-5',
        promptTokens: 400,
        completionTokens: 250,
        totalTokens: 650,
        cost: 12.3,
      });

      // Export cost history
      const exportPath = path.join(tempDir, 'export.json');
      await costTracker.export(exportPath);

      expect(fs.existsSync(exportPath)).toBe(true);

      // Verify exported data (export() saves entries array directly)
      const exported = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
      expect(Array.isArray(exported)).toBe(true);
      expect(exported).toHaveLength(2);
      expect(exported[0].provider).toBe('anthropic');
      expect(exported[0].cost).toBe(8.5);
      expect(exported[1].provider).toBe('openai');
      expect(exported[1].cost).toBe(12.3);

      // Verify summary from cost tracker
      const summary = await costTracker.getMonthlySummary();
      expect(summary.totalSpend).toBe(20.8);
      expect(summary.requestCount).toBe(2);
      expect(summary.byProvider.anthropic).toBe(8.5);
      expect(summary.byProvider.openai).toBe(12.3);
    });
  });

  describe('Budget override workflow', () => {
    it('should respect budget override in routing options', async () => {
      // Record spend up to regular budget
      await costTracker.recordCost({
        provider: 'anthropic',
        model: 'claude-opus-4',
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
        cost: 50.0,
      });

      const spend = await router.getMonthlySpend();
      expect(spend).toBe(50.0);

      // Regular routing should fall back to local
      const decision1 = await router.route({
        prompt: 'Complex task',
        estimatedTokens: 5000,
        complexity: 0.9,
      });
      expect(decision1.target.type).toBe('local');

      // But with budget override, should allow API
      const decision2 = await router.route(
        {
          prompt: 'Complex task',
          estimatedTokens: 5000,
          complexity: 0.9,
        },
        {
          budgetOverride: 100.0, // Override to $100
        }
      );
      expect(decision2.target.type).toBe('api');
      expect(decision2.target.provider).toBe('openai');
    });
  });
});
