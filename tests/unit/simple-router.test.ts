/**
 * Unit tests for SimpleRouter
 */

import { SimpleRouter } from '../../src/routers/simple-router';

describe('SimpleRouter', () => {
  describe('Basic functionality', () => {
    it('should have correct name', () => {
      const router = new SimpleRouter();
      expect(router.name).toBe('simple');
    });

    it('should use default configuration', async () => {
      const router = new SimpleRouter();
      const decision = await router.route({ prompt: 'test' });

      expect(decision.target.type).toBe('local');
      expect(decision.target.provider).toBe('ollama');
      expect(decision.target.model).toBe('qwen3-coder-30b');
      expect(decision.estimatedCost).toBe(0);
    });

    it('should accept custom configuration', async () => {
      const router = new SimpleRouter({
        defaultModel: 'llama-3.1-70b',
        defaultProvider: 'custom-provider',
      });

      const decision = await router.route({ prompt: 'test' });

      expect(decision.target.provider).toBe('custom-provider');
      expect(decision.target.model).toBe('llama-3.1-70b');
    });
  });

  describe('Task-specific routing', () => {
    it('should route quantum tasks to specialized model', async () => {
      const router = new SimpleRouter();
      const decision = await router.route({
        prompt: 'quantum circuit optimization',
        taskType: 'quantum',
      });

      expect(decision.target.model).toBe('granite-8b-qiskit');
      expect(decision.rationale.toLowerCase()).toContain('quantum');
    });

    it('should route regular tasks to default model', async () => {
      const router = new SimpleRouter();
      const decision = await router.route({
        prompt: 'regular code review',
        taskType: 'code-review',
      });

      expect(decision.target.model).toBe('qwen3-coder-30b');
    });
  });

  describe('Force overrides', () => {
    it('should respect force model override', async () => {
      const router = new SimpleRouter();
      const decision = await router.route(
        { prompt: 'test' },
        { forceModel: 'custom-model' }
      );

      expect(decision.target.model).toBe('custom-model');
      expect(decision.rationale).toContain('override');
    });

    it('should respect force provider override', async () => {
      const router = new SimpleRouter();
      const decision = await router.route(
        { prompt: 'test' },
        { forceProvider: 'custom-provider' }
      );

      expect(decision.target.provider).toBe('custom-provider');
    });

    it('should respect both model and provider overrides', async () => {
      const router = new SimpleRouter();
      const decision = await router.route(
        { prompt: 'test' },
        { forceModel: 'custom-model', forceProvider: 'custom-provider' }
      );

      expect(decision.target.model).toBe('custom-model');
      expect(decision.target.provider).toBe('custom-provider');
    });
  });

  describe('Cost and latency estimates', () => {
    it('should always return zero cost for local models', async () => {
      const router = new SimpleRouter();
      const decision = await router.route({
        prompt: 'test',
        estimatedTokens: 10000,
      });

      expect(decision.estimatedCost).toBe(0);
    });

    it('should estimate latency based on token count', async () => {
      const router = new SimpleRouter();
      const decision = await router.route({
        prompt: 'test',
        estimatedTokens: 1000,
      });

      expect(decision.estimatedLatency).toBeGreaterThan(0);
    });
  });

  describe('Decision metadata', () => {
    it('should include rationale in decision', async () => {
      const router = new SimpleRouter();
      const decision = await router.route({ prompt: 'test' });

      expect(decision.rationale).toBeDefined();
      expect(typeof decision.rationale).toBe('string');
      expect(decision.rationale.length).toBeGreaterThan(0);
    });

    it('should include confidence score', async () => {
      const router = new SimpleRouter();
      const decision = await router.route({ prompt: 'test' });

      expect(decision.confidence).toBeDefined();
      expect(decision.confidence).toBeGreaterThanOrEqual(0);
      expect(decision.confidence).toBeLessThanOrEqual(1);
    });
  });
});
