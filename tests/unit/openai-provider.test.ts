/**
 * Unit tests for OpenAI Provider
 */

import { OpenAIProvider } from '../../src/providers/openai-provider';

// Mock fetch globally
global.fetch = jest.fn();

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  const mockApiKey = 'sk-test-key-123';

  beforeEach(() => {
    provider = new OpenAIProvider({
      apiKey: mockApiKey,
    });
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should require API key', () => {
      expect(() => new OpenAIProvider({ apiKey: '' })).toThrow('OpenAI API key is required');
    });

    it('should use default base URL when not provided', () => {
      const defaultProvider = new OpenAIProvider({ apiKey: mockApiKey });
      expect(defaultProvider).toBeDefined();
    });

    it('should accept custom base URL', () => {
      const customProvider = new OpenAIProvider({
        apiKey: mockApiKey,
        baseUrl: 'https://custom.api.com/v1',
      });
      expect(customProvider).toBeDefined();
    });

    it('should accept organization ID', () => {
      const orgProvider = new OpenAIProvider({
        apiKey: mockApiKey,
        organization: 'org-123',
      });
      expect(orgProvider).toBeDefined();
    });
  });

  describe('isAvailable', () => {
    it('should return true for valid API key format', async () => {
      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });

    it('should return false for invalid API key format', async () => {
      const invalidProvider = new OpenAIProvider({ apiKey: 'invalid-key' });
      const available = await invalidProvider.isAvailable();
      expect(available).toBe(false);
    });
  });

  describe('listModels', () => {
    it('should return list of GPT models from API', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [
            { id: 'gpt-5', object: 'model', created: 1234567890, owned_by: 'openai' },
            { id: 'gpt-4o', object: 'model', created: 1234567891, owned_by: 'openai' },
            { id: 'dall-e-3', object: 'model', created: 1234567892, owned_by: 'openai' },
          ],
        }),
      });

      const models = await provider.listModels();
      expect(models).toContain('gpt-5');
      expect(models).toContain('gpt-4o');
      expect(models).not.toContain('dall-e-3'); // Should filter out non-chat models
    });

    it('should return fallback models on API error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: 'Unauthorized',
      });

      const models = await provider.listModels();
      expect(models).toContain('gpt-5');
      expect(models).toContain('gpt-4o');
      expect(models.length).toBeGreaterThan(0);
    });
  });

  describe('generate', () => {
    it('should generate completion for a prompt', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1234567890,
          model: 'gpt-5',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'This is a test response',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 12,
            completion_tokens: 18,
            total_tokens: 30,
          },
        }),
      });

      const result = await provider.generate('gpt-5', {
        prompt: 'Hello world',
      });

      expect(result.text).toBe('This is a test response');
      expect(result.model).toBe('gpt-5');
      expect(result.provider).toBe('openai');
      expect(result.promptTokens).toBe(12);
      expect(result.completionTokens).toBe(18);
      expect(result.totalTokens).toBe(30);
      expect(result.finishReason).toBe('completed');
    });

    it('should handle generation with parameters', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1234567890,
          model: 'gpt-5',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Response with parameters',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 20,
            completion_tokens: 25,
            total_tokens: 45,
          },
        }),
      });

      const result = await provider.generate('gpt-5', {
        prompt: 'Test prompt',
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 2000,
        stop: ['END'],
        systemPrompt: 'You are a helpful assistant',
      });

      expect(result.text).toBe('Response with parameters');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockApiKey}`,
          }),
          body: expect.stringContaining('"temperature":0.7'),
        })
      );
    });

    it('should include system message when systemPrompt provided', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1234567890,
          model: 'gpt-5',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Response' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      });

      await provider.generate('gpt-5', {
        prompt: 'Test',
        systemPrompt: 'Be concise',
      });

      const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(callBody.messages).toHaveLength(2);
      expect(callBody.messages[0].role).toBe('system');
      expect(callBody.messages[0].content).toBe('Be concise');
      expect(callBody.messages[1].role).toBe('user');
    });

    it('should handle organization header when provided', async () => {
      const orgProvider = new OpenAIProvider({
        apiKey: mockApiKey,
        organization: 'org-123',
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1234567890,
          model: 'gpt-5',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Response' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      });

      await orgProvider.generate('gpt-5', { prompt: 'Test' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'OpenAI-Organization': 'org-123',
          }),
        })
      );
    });

    it('should handle length finish reason', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1234567890,
          model: 'gpt-5',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Truncated' },
              finish_reason: 'length',
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 4096, total_tokens: 4106 },
        }),
      });

      const result = await provider.generate('gpt-5', { prompt: 'Long prompt' });
      expect(result.finishReason).toBe('length');
    });

    it('should handle content_filter finish reason as error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1234567890,
          model: 'gpt-5',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: '' },
              finish_reason: 'content_filter',
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
        }),
      });

      const result = await provider.generate('gpt-5', { prompt: 'Filtered' });
      expect(result.finishReason).toBe('error');
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({
          error: {
            message: 'Rate limit exceeded',
            type: 'rate_limit_error',
          },
        }),
      });

      await expect(provider.generate('gpt-5', { prompt: 'Test' })).rejects.toThrow(
        'Rate limit exceeded'
      );
    });

    it('should throw error when no choices returned', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1234567890,
          model: 'gpt-5',
          choices: [],
          usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
        }),
      });

      await expect(provider.generate('gpt-5', { prompt: 'Test' })).rejects.toThrow(
        'No completion choices returned'
      );
    });

    it('should handle null finish reason as completed', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1234567890,
          model: 'gpt-5',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Response' },
              finish_reason: null,
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      });

      const result = await provider.generate('gpt-5', { prompt: 'Test' });

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
                  'data: ' +
                    JSON.stringify({
                      id: 'chatcmpl-123',
                      object: 'chat.completion.chunk',
                      created: 1234567890,
                      model: 'gpt-5',
                      choices: [
                        {
                          index: 0,
                          delta: { content: 'Hello' },
                          finish_reason: null,
                        },
                      ],
                    }) +
                    '\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: ' +
                    JSON.stringify({
                      id: 'chatcmpl-123',
                      object: 'chat.completion.chunk',
                      created: 1234567890,
                      model: 'gpt-5',
                      choices: [
                        {
                          index: 0,
                          delta: { content: ' world' },
                          finish_reason: null,
                        },
                      ],
                    }) +
                    '\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: ' +
                    JSON.stringify({
                      id: 'chatcmpl-123',
                      object: 'chat.completion.chunk',
                      created: 1234567890,
                      model: 'gpt-5',
                      choices: [
                        {
                          index: 0,
                          delta: {},
                          finish_reason: 'stop',
                        },
                      ],
                    }) +
                    '\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: [DONE]\n'),
              })
              .mockResolvedValueOnce({
                done: true,
              }),
          }),
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const chunks: string[] = [];
      const generator = provider.generateStream('gpt-5', { prompt: 'Test' });

      for await (const chunk of generator) {
        if ('text' in chunk && 'done' in chunk) {
          chunks.push(chunk.text);
        } else {
          // Final response
          expect(chunk.text).toBe('Hello world');
          expect(chunk.finishReason).toBe('completed');
        }
      }

      expect(chunks).toEqual(['Hello', ' world']);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status for valid API key', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [
            { id: 'gpt-5', object: 'model', created: 123, owned_by: 'openai' },
            { id: 'gpt-4o', object: 'model', created: 124, owned_by: 'openai' },
          ],
        }),
      });

      const health = await provider.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.modelCount).toBeGreaterThan(0);
    });

    it('should return unhealthy status for invalid API key', async () => {
      const invalidProvider = new OpenAIProvider({ apiKey: 'invalid' });
      const health = await invalidProvider.healthCheck();
      expect(health.healthy).toBe(false);
      expect(health.error).toContain('Invalid or missing OpenAI API key');
    });
  });
});
