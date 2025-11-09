/**
 * Unit tests for Anthropic Provider
 */

import { AnthropicProvider } from '../../src/providers/anthropic-provider';

// Mock fetch globally
global.fetch = jest.fn();

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;
  const mockApiKey = 'sk-ant-test-key';

  beforeEach(() => {
    provider = new AnthropicProvider({
      apiKey: mockApiKey,
    });
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should require API key', () => {
      expect(() => new AnthropicProvider({ apiKey: '' })).toThrow(
        'Anthropic API key is required'
      );
    });

    it('should use default base URL when not provided', () => {
      const defaultProvider = new AnthropicProvider({ apiKey: mockApiKey });
      expect(defaultProvider).toBeDefined();
    });

    it('should accept custom base URL', () => {
      const customProvider = new AnthropicProvider({
        apiKey: mockApiKey,
        baseUrl: 'https://custom.api.com',
      });
      expect(customProvider).toBeDefined();
    });
  });

  describe('isAvailable', () => {
    it('should return true for valid API key format', async () => {
      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });

    it('should return false for invalid API key format', async () => {
      const invalidProvider = new AnthropicProvider({ apiKey: 'invalid-key' });
      const available = await invalidProvider.isAvailable();
      expect(available).toBe(false);
    });
  });

  describe('listModels', () => {
    it('should return list of Anthropic models', async () => {
      const models = await provider.listModels();
      expect(models).toContain('claude-opus-4');
      expect(models).toContain('claude-sonnet-4');
      expect(models.length).toBeGreaterThan(0);
    });
  });

  describe('generate', () => {
    it('should generate completion for a prompt', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'This is a test response' }],
          model: 'claude-opus-4',
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: {
            input_tokens: 15,
            output_tokens: 20,
          },
        }),
      });

      const result = await provider.generate('claude-opus-4', {
        prompt: 'Hello world',
      });

      expect(result.text).toBe('This is a test response');
      expect(result.model).toBe('claude-opus-4');
      expect(result.provider).toBe('anthropic');
      expect(result.promptTokens).toBe(15);
      expect(result.completionTokens).toBe(20);
      expect(result.totalTokens).toBe(35);
      expect(result.finishReason).toBe('completed');
    });

    it('should handle generation with parameters', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Response with parameters' }],
          model: 'claude-opus-4',
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: {
            input_tokens: 10,
            output_tokens: 15,
          },
        }),
      });

      const result = await provider.generate('claude-opus-4', {
        prompt: 'Test prompt',
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 2000,
        stop: ['END'],
        systemPrompt: 'You are a helpful assistant',
      });

      expect(result.text).toBe('Response with parameters');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-api-key': mockApiKey,
            'anthropic-version': '2023-06-01',
          }),
        })
      );
    });

    it('should handle max_tokens finish reason', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Truncated response' }],
          model: 'claude-opus-4',
          stop_reason: 'max_tokens',
          stop_sequence: null,
          usage: {
            input_tokens: 10,
            output_tokens: 4096,
          },
        }),
      });

      const result = await provider.generate('claude-opus-4', {
        prompt: 'Long prompt',
      });

      expect(result.finishReason).toBe('length');
    });

    it('should handle stop_sequence finish reason', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Stopped response' }],
          model: 'claude-opus-4',
          stop_reason: 'stop_sequence',
          stop_sequence: 'END',
          usage: {
            input_tokens: 10,
            output_tokens: 20,
          },
        }),
      });

      const result = await provider.generate('claude-opus-4', {
        prompt: 'Test',
        stop: ['END'],
      });

      expect(result.finishReason).toBe('stop');
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({
          error: {
            type: 'rate_limit_error',
            message: 'Rate limit exceeded',
          },
        }),
      });

      await expect(
        provider.generate('claude-opus-4', { prompt: 'Test' })
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle multiple content blocks', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'text', text: 'First block. ' },
            { type: 'text', text: 'Second block.' },
          ],
          model: 'claude-opus-4',
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: {
            input_tokens: 10,
            output_tokens: 20,
          },
        }),
      });

      const result = await provider.generate('claude-opus-4', { prompt: 'Test' });

      expect(result.text).toBe('First block. Second block.');
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
                      type: 'message_start',
                      message: {
                        usage: { input_tokens: 10 },
                      },
                    }) +
                    '\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: ' +
                    JSON.stringify({
                      type: 'content_block_delta',
                      delta: { type: 'text_delta', text: 'Hello' },
                    }) +
                    '\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: ' +
                    JSON.stringify({
                      type: 'content_block_delta',
                      delta: { type: 'text_delta', text: ' world' },
                    }) +
                    '\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: ' +
                    JSON.stringify({
                      type: 'message_delta',
                      usage: { output_tokens: 5 },
                    }) +
                    '\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: ' + JSON.stringify({ type: 'message_stop' }) + '\n'
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
      const generator = provider.generateStream('claude-opus-4', {
        prompt: 'Test',
      });

      for await (const chunk of generator) {
        if ('text' in chunk && 'done' in chunk) {
          chunks.push(chunk.text);
        } else {
          // Final response
          expect(chunk.text).toBe('Hello world');
          expect(chunk.promptTokens).toBe(10);
          expect(chunk.completionTokens).toBe(5);
        }
      }

      expect(chunks).toEqual(['Hello', ' world']);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status for valid API key', async () => {
      const health = await provider.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.modelCount).toBeGreaterThan(0);
    });

    it('should return unhealthy status for invalid API key', async () => {
      const invalidProvider = new AnthropicProvider({ apiKey: 'invalid' });
      const health = await invalidProvider.healthCheck();
      expect(health.healthy).toBe(false);
      expect(health.error).toContain('Invalid or missing Anthropic API key');
    });
  });
});
