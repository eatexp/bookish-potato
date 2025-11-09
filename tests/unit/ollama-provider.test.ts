/**
 * Unit tests for Ollama Provider
 */

import { OllamaProvider } from '../../src/providers/ollama-provider';

// Mock fetch globally
global.fetch = jest.fn();

describe('OllamaProvider', () => {
  let provider: OllamaProvider;

  beforeEach(() => {
    provider = new OllamaProvider({
      baseUrl: 'http://localhost:11434',
    });
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should use default base URL when not provided', () => {
      const defaultProvider = new OllamaProvider();
      expect(defaultProvider).toBeDefined();
    });

    it('should accept custom base URL', () => {
      const customProvider = new OllamaProvider({
        baseUrl: 'http://custom:8080',
      });
      expect(customProvider).toBeDefined();
    });
  });

  describe('isAvailable', () => {
    it('should return true when Ollama is reachable', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
      });

      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });

    it('should return false when Ollama is not reachable', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Connection refused'));

      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });

    it('should handle timeout gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('timeout'));

      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });
  });

  describe('listModels', () => {
    it('should return list of available models', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            { name: 'llama3.1:70b', modified_at: '2024-01-01', size: 40000000000, digest: 'abc' },
            {
              name: 'qwen3-coder:30b',
              modified_at: '2024-01-02',
              size: 20000000000,
              digest: 'def',
            },
          ],
        }),
      });

      const models = await provider.listModels();
      expect(models).toEqual(['llama3.1:70b', 'qwen3-coder:30b']);
    });

    it('should throw on API error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
      });

      await expect(provider.listModels()).rejects.toThrow(
        'Failed to list models: Internal Server Error'
      );
    });
  });

  describe('generate', () => {
    it('should generate completion for a prompt', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          model: 'llama3.1:70b',
          created_at: '2024-01-01T00:00:00Z',
          response: 'This is a test response',
          done: true,
          prompt_eval_count: 10,
          eval_count: 5,
        }),
      });

      const result = await provider.generate('llama3.1:70b', {
        prompt: 'Hello world',
      });

      expect(result.text).toBe('This is a test response');
      expect(result.model).toBe('llama3.1:70b');
      expect(result.provider).toBe('ollama');
      expect(result.promptTokens).toBe(10);
      expect(result.completionTokens).toBe(5);
      expect(result.totalTokens).toBe(15);
      expect(result.finishReason).toBe('completed');
    });

    it('should handle generation with parameters', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          model: 'llama3.1:70b',
          created_at: '2024-01-01T00:00:00Z',
          response: 'Response with parameters',
          done: true,
          prompt_eval_count: 10,
          eval_count: 8,
        }),
      });

      const result = await provider.generate('llama3.1:70b', {
        prompt: 'Test prompt',
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 1000,
        stop: ['END'],
        systemPrompt: 'You are a helpful assistant',
      });

      expect(result.text).toBe('Response with parameters');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining('"temperature":0.7'),
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      await expect(
        provider.generate('llama3.1:70b', { prompt: 'Test' })
      ).rejects.toThrow('Ollama API error');
    });

    it('should estimate tokens when actual counts not provided', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          model: 'llama3.1:70b',
          created_at: '2024-01-01T00:00:00Z',
          response: 'Short response',
          done: true,
          // No token counts provided
        }),
      });

      const result = await provider.generate('llama3.1:70b', {
        prompt: 'Test prompt',
      });

      expect(result.promptTokens).toBeGreaterThan(0);
      expect(result.completionTokens).toBeGreaterThan(0);
      expect(result.finishReason).toBe('completed');
    });
  });

  describe('generateStream', () => {
    it('should stream completion chunks', async () => {
      const mockResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: jest
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  JSON.stringify({
                    model: 'llama3.1:70b',
                    response: 'Hello',
                    done: false,
                  }) + '\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  JSON.stringify({
                    model: 'llama3.1:70b',
                    response: ' world',
                    done: true,
                    prompt_eval_count: 5,
                    eval_count: 2,
                  }) + '\n'
                ),
              })
              .mockResolvedValueOnce({
                done: true,
              }),
          }),
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const chunks: string[] = [];
      const generator = provider.generateStream('llama3.1:70b', {
        prompt: 'Test',
      });

      for await (const chunk of generator) {
        if ('text' in chunk) {
          chunks.push(chunk.text);
        } else {
          // Final response
          expect(chunk.text).toBe('Hello world');
          expect(chunk.promptTokens).toBe(5);
          expect(chunk.completionTokens).toBe(2);
        }
      }

      expect(chunks).toEqual(['Hello', ' world']);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when Ollama is available', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            models: [
              { name: 'model1', modified_at: '', size: 0, digest: '' },
              { name: 'model2', modified_at: '', size: 0, digest: '' },
            ],
          }),
        });

      const health = await provider.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.modelCount).toBe(2);
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should return unhealthy status when Ollama is not available', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Connection refused'));

      const health = await provider.healthCheck();
      expect(health.healthy).toBe(false);
      expect(health.error).toContain('Ollama service is not running');
      expect(health.warnings).toBeDefined();
    });

    it('should warn when no models are installed', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            models: [],
          }),
        });

      const health = await provider.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.modelCount).toBe(0);
      expect(health.warnings).toBeDefined();
      expect(health.warnings?.[0]).toContain('No models installed');
    });
  });
});
