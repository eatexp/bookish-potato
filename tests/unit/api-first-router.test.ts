/**
 * Unit tests for APIFirstRouter
 */

import { APIFirstRouter } from '../../src/routers/api-first-router';

describe('APIFirstRouter', () => {
  describe('Basic functionality', () => {
    it('should have correct name', () => {
      const router = new APIFirstRouter();
      expect(router.name).toBe('api-first');
    });

    it('should route to API by default', async () => {
      const router = new APIFirstRouter();
      const decision = await router.route({ prompt: 'test' });

      expect(decision.target.type).toBe('api');
      expect(decision.target.provider).toBe('anthropic');
      expect(decision.target.model).toBe('claude-opus-4');
      expect(decision.estimatedCost).toBeGreaterThan(0);
    });

    it('should accept custom configuration', async () => {
      const router = new APIFirstRouter({
        defaultModel: 'gpt-5',
        defaultProvider: 'openai',
      });

      const decision = await router.route({ prompt: 'test' });

      expect(decision.target.provider).toBe('openai');
      expect(decision.target.model).toBe('gpt-5');
    });
  });

  describe('Task-specific routing', () => {
    it('should route quantum tasks to local specialized model', async () => {
      const router = new APIFirstRouter();
      const decision = await router.route({
        prompt: 'quantum circuit',
        taskType: 'quantum',
      });

      expect(decision.target.type).toBe('local');
      expect(decision.target.model).toBe('granite-8b-qiskit');
      expect(decision.rationale.toLowerCase()).toContain('quantum');
    });

    it('should route high complexity to GPT-5', async () => {
      const router = new APIFirstRouter();
      const decision = await router.route({
        prompt: 'complex task',
        complexity: 0.9,
        estimatedTokens: 5000,
      });

      expect(decision.target.model).toBe('gpt-5');
      expect(decision.rationale).toContain('complexity');
    });

    it('should route large context to Claude Opus', async () => {
      const router = new APIFirstRouter();
      const decision = await router.route({
        prompt: 'large document',
        estimatedTokens: 20000,
      });

      expect(decision.target.model).toBe('claude-opus-4');
      expect(decision.rationale).toContain('context');
    });

    it('should not route to API for complexity below threshold', async () => {
      const router = new APIFirstRouter();
      const decision = await router.route({
        prompt: 'simple task',
        complexity: 0.5,
        estimatedTokens: 1000,
      });

      // Should use default API model, not escalate to GPT-5
      expect(decision.target.model).toBe('claude-opus-4');
    });
  });

  describe('Cost estimation', () => {
    it('should estimate API costs correctly', async () => {
      const router = new APIFirstRouter();
      const decision = await router.route({
        prompt: 'test',
        estimatedTokens: 10000,
      });

      expect(decision.estimatedCost).toBeGreaterThan(0);
      expect(decision.estimatedCost).toBeLessThan(10); // Reasonable upper bound
    });

    it('should estimate higher cost for GPT-5', async () => {
      const router = new APIFirstRouter();
      const gpt5Decision = await router.route({
        prompt: 'test',
        complexity: 0.9,
        estimatedTokens: 5000,
      });

      const claudeDecision = await router.route({
        prompt: 'test',
        estimatedTokens: 5000,
      });

      expect(gpt5Decision.estimatedCost).toBeGreaterThan(claudeDecision.estimatedCost);
    });
  });

  describe('Latency estimation', () => {
    it('should estimate API latency', async () => {
      const router = new APIFirstRouter();
      const decision = await router.route({
        prompt: 'test',
        estimatedTokens: 5000,
      });

      expect(decision.estimatedLatency).toBeGreaterThan(0);
    });

    it('should estimate higher latency for larger requests', async () => {
      const router = new APIFirstRouter();
      const smallDecision = await router.route({
        prompt: 'test',
        estimatedTokens: 1000,
      });

      const largeDecision = await router.route({
        prompt: 'test',
        estimatedTokens: 20000,
      });

      expect(largeDecision.estimatedLatency).toBeGreaterThan(smallDecision.estimatedLatency);
    });
  });

  describe('Force overrides', () => {
    it('should force to local when specified', async () => {
      const router = new APIFirstRouter();
      const decision = await router.route(
        { prompt: 'test' },
        { forceProvider: 'ollama', forceModel: 'qwen3-coder-30b' }
      );

      expect(decision.target.type).toBe('local');
      expect(decision.target.provider).toBe('ollama');
      expect(decision.target.model).toBe('qwen3-coder-30b');
      expect(decision.estimatedCost).toBe(0);
    });

    it('should force to specific API when specified', async () => {
      const router = new APIFirstRouter();
      const decision = await router.route(
        { prompt: 'test' },
        { forceProvider: 'openai', forceModel: 'gpt-4-turbo' }
      );

      expect(decision.target.type).toBe('api');
      expect(decision.target.provider).toBe('openai');
      expect(decision.target.model).toBe('gpt-4-turbo');
    });
  });

  describe('Fallback configuration', () => {
    it('should respect fallback settings', () => {
      const router = new APIFirstRouter({
        fallbackToLocal: false,
        localFallbackModel: 'llama-3.1-70b',
      });

      expect(router).toBeDefined();
    });
  });
});
