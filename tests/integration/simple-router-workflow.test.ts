/**
 * Integration test: Simple Router Workflow
 *
 * Tests the complete workflow from routing decision to mock execution
 * using the SimpleRouter with a simulated provider.
 */

import { SimpleRouter } from '../../src/routers/simple-router';
import { OllamaProvider } from '../../src/providers/ollama-provider';

// Mock fetch for Ollama API calls
global.fetch = jest.fn();

describe('Integration: Simple Router Workflow', () => {
  let router: SimpleRouter;

  beforeEach(() => {
    router = new SimpleRouter({
      defaultModel: 'qwen3-coder-30b',
      defaultProvider: 'ollama',
    });
    jest.clearAllMocks();
  });

  describe('Complete routing and execution workflow', () => {
    it('should route a simple task and execute successfully', async () => {
      // Step 1: Make routing decision
      const decision = await router.route({
        prompt: 'Write a hello world function',
        estimatedTokens: 500,
      });

      // Verify routing decision
      expect(decision.target.type).toBe('local');
      expect(decision.target.provider).toBe('ollama');
      expect(decision.target.model).toBe('qwen3-coder-30b');
      expect(decision.estimatedCost).toBe(0);
      expect(decision.rationale).toContain('Default local routing');

      // Step 2: Create provider based on decision
      const provider = new OllamaProvider({
        baseUrl: 'http://localhost:11434',
      });

      // Mock Ollama generate response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'qwen3-coder-30b',
          created_at: '2024-01-01T00:00:00Z',
          response: 'def hello_world():\n    print("Hello, World!")',
          done: true,
          total_duration: 1500000000,
          prompt_eval_count: 12,
          eval_count: 25,
        }),
      });

      // Step 3: Execute inference
      const result = await provider.generate(decision.target.model, {
        prompt: 'Write a hello world function',
        temperature: 0.7,
        maxTokens: 500,
      });

      // Verify execution result
      expect(result.text).toContain('hello_world');
      expect(result.provider).toBe('ollama');
      expect(result.model).toBe('qwen3-coder-30b');
      expect(result.finishReason).toBe('completed');
      expect(result.promptTokens).toBeGreaterThan(0);
      expect(result.completionTokens).toBeGreaterThan(0);
    });

    it('should route quantum task to specialized model', async () => {
      // Step 1: Route quantum-specific task
      const decision = await router.route({
        prompt: 'Optimize this quantum circuit for NISQ devices',
        estimatedTokens: 1000,
        taskType: 'quantum',
      });

      // Verify specialized routing
      expect(decision.target.model).toBe('granite-8b-qiskit');
      expect(decision.rationale).toContain('Quantum task');
      expect(decision.target.type).toBe('local');

      // Step 2: Create provider
      const provider = new OllamaProvider({
        baseUrl: 'http://localhost:11434',
      });

      // Mock specialized model response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'granite-8b-qiskit',
          response: 'To optimize for NISQ: 1) Reduce circuit depth...',
          done: true,
          prompt_eval_count: 50,
          eval_count: 100,
        }),
      });

      // Step 3: Execute
      const result = await provider.generate(decision.target.model, {
        prompt: 'Optimize this quantum circuit',
      });

      expect(result.model).toBe('granite-8b-qiskit');
      expect(result.text).toContain('NISQ');
      expect(result.finishReason).toBe('completed');
    });

    it('should handle provider unavailability gracefully', async () => {
      // Step 1: Make routing decision (always succeeds)
      const decision = await router.route({
        prompt: 'Simple task',
        estimatedTokens: 100,
      });

      expect(decision.target.provider).toBe('ollama');

      // Step 2: Create provider
      const provider = new OllamaProvider({
        baseUrl: 'http://localhost:11434',
      });

      // Mock provider unavailable (connection refused)
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('connect ECONNREFUSED')
      );

      // Step 3: Check availability before execution
      const available = await provider.isAvailable();
      expect(available).toBe(false);

      // In real workflow, this would trigger fallback or error message
    });
  });

  describe('Multiple requests workflow', () => {
    it('should handle sequential requests efficiently', async () => {
      const requests = [
        { prompt: 'Task 1', estimatedTokens: 100 },
        { prompt: 'Task 2', estimatedTokens: 200 },
        { prompt: 'Task 3', estimatedTokens: 150 },
      ];

      const provider = new OllamaProvider({
        baseUrl: 'http://localhost:11434',
      });

      // Mock responses for all requests
      for (let i = 0; i < requests.length; i++) {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            model: 'qwen3-coder-30b',
            response: `Response ${i + 1}`,
            done: true,
            prompt_eval_count: 10,
            eval_count: 20,
          }),
        });
      }

      // Process all requests
      const results = [];
      for (const req of requests) {
        const decision = await router.route(req);
        expect(decision.target.type).toBe('local');

        const result = await provider.generate(decision.target.model, {
          prompt: req.prompt,
        });
        results.push(result);
      }

      // Verify all succeeded
      expect(results).toHaveLength(3);
      results.forEach((result, i) => {
        expect(result.text).toBe(`Response ${i + 1}`);
        expect(result.finishReason).toBe('completed');
      });
    });
  });

  describe('Force override workflow', () => {
    it('should respect force overrides in routing', async () => {
      // Force to specific model
      const decision = await router.route(
        {
          prompt: 'Any task',
          estimatedTokens: 500,
        },
        {
          forceModel: 'llama-3.1-70b',
          forceProvider: 'ollama',
        }
      );

      expect(decision.target.model).toBe('llama-3.1-70b');
      expect(decision.target.provider).toBe('ollama');
      expect(decision.rationale).toContain('User override');
    });
  });
});
