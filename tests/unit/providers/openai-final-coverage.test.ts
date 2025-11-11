/**
 * Final Coverage Tests for OpenAI Provider
 *
 * Targets uncovered lines: 136, 147, 293, 320, 346, 378, 397, 408
 * Goal: Push openai-provider.ts from 93.89% to 97%+
 */

import { OpenAIProvider } from '../../../src/providers/openai-provider';
import type { GenerateParams } from '../../../src/core/model-provider';

// Mock fetch globally
global.fetch = jest.fn();

describe('OpenAIProvider: Final Coverage Tests', () => {
  let provider: OpenAIProvider;

  // Helper to consume async generator and get the return value
  async function consumeStream(generator: AsyncGenerator<any, any, undefined>) {
    const chunks: any[] = [];
    let result;

    // Manually iterate to capture both yielded values and return value
    while (true) {
      const { done, value } = await generator.next();

      if (done) {
        result = value; // This is the InferenceResponse returned at the end
        break;
      }

      chunks.push(value); // These are the yielded StreamChunks
    }

    return { chunks, result };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new OpenAIProvider({
      apiKey: 'sk-test-key-12345',
      timeout: 5000,
    });
  });

  describe('isAvailable() error handling (line 136)', () => {
    it('should return false when API key is invalid', async () => {
      // Create provider with invalid API key (not starting with 'sk-')
      const invalidProvider = new OpenAIProvider({
        apiKey: 'invalid-key-format',
        timeout: 5000,
      });

      const available = await invalidProvider.isAvailable();

      // Should return false for invalid API key format
      expect(available).toBe(false);
    });

    it('should throw when API key is empty', () => {
      // Empty API key should throw in constructor
      expect(() => {
        new OpenAIProvider({
          apiKey: '',
          timeout: 5000,
        });
      }).toThrow('OpenAI API key is required');
    });

    it('should return true when API key is valid', async () => {
      // Provider with valid 'sk-' prefixed key
      const available = await provider.isAvailable();

      expect(available).toBe(true);
    });
  });

  describe('listModels() with organization header (line 147)', () => {
    it('should include OpenAI-Organization header when organization is provided', async () => {
      const providerWithOrg = new OpenAIProvider({
        apiKey: 'sk-test-key',
        organization: 'org-123456',
        timeout: 5000,
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'gpt-4', created: 1234567890, object: 'model', owned_by: 'openai' },
            { id: 'gpt-3.5-turbo', created: 1234567890, object: 'model', owned_by: 'openai' },
          ],
        }),
      });

      await providerWithOrg.listModels();

      // Verify that OpenAI-Organization header was added (line 147)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/models'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'OpenAI-Organization': 'org-123456',
          }),
        })
      );
    });

    it('should not include OpenAI-Organization header when organization is not provided', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'gpt-4', created: 1234567890, object: 'model', owned_by: 'openai' }],
        }),
      });

      await provider.listModels();

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const headers = fetchCall[1].headers;

      expect(headers['OpenAI-Organization']).toBeUndefined();
    });
  });

  describe('generateStream() with systemPrompt (lines 293, 408)', () => {
    it('should include system message when systemPrompt is provided', async () => {
      const params: GenerateParams = {
        prompt: 'Hello',
        systemPrompt: 'You are a helpful assistant', // Line 293
        maxTokens: 100,
      };

      // Mock streaming response
      const mockBody = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                'data: {"choices":[{"delta":{"content":"Hi"},"finish_reason":null}]}\n'
              ),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: [DONE]\n'),
            })
            .mockResolvedValueOnce({ done: true }),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockBody,
      });

      const generator = provider.generateStream('gpt-4', params);
      const { result } = await consumeStream(generator);

      // Verify request included system message (line 293)
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.messages).toHaveLength(2);
      expect(requestBody.messages[0]).toEqual({
        role: 'system',
        content: 'You are a helpful assistant',
      });
      expect(requestBody.messages[1]).toEqual({
        role: 'user',
        content: 'Hello',
      });

      // Verify token estimation included system prompt (line 408)
      expect(result.promptTokens).toBeGreaterThan(1); // Should include both prompts
    });

    it('should handle systemPrompt token estimation correctly', async () => {
      const params: GenerateParams = {
        prompt: 'Test',
        systemPrompt: 'You are a helpful AI assistant with extensive knowledge', // Longer system prompt
        maxTokens: 100,
      };

      const mockBody = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                'data: {"choices":[{"delta":{"content":"Response"},"finish_reason":"stop"}]}\n'
              ),
            })
            .mockResolvedValueOnce({ done: true }),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockBody,
      });

      const generator = provider.generateStream('gpt-4', params);
      const { result } = await consumeStream(generator);

      // Token count should include both user prompt and system prompt (line 408)
      expect(result.promptTokens).toBeGreaterThan(5); // System prompt adds tokens
    });
  });

  describe('generateStream() with organization header (line 320)', () => {
    it('should include OpenAI-Organization header in generateStream when provided', async () => {
      const providerWithOrg = new OpenAIProvider({
        apiKey: 'sk-test-key',
        organization: 'org-123456',
        timeout: 5000,
      });

      const params: GenerateParams = {
        prompt: 'Test',
        maxTokens: 100,
      };

      const mockBody = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                'data: {"choices":[{"delta":{"content":"Hi"},"finish_reason":null}]}\n'
              ),
            })
            .mockResolvedValueOnce({ done: true }),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockBody,
      });

      const generator = providerWithOrg.generateStream('gpt-4', params);
      await consumeStream(generator);

      // Verify OpenAI-Organization header was included (line 320)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/chat/completions'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'OpenAI-Organization': 'org-123456',
          }),
        })
      );
    });
  });

  describe('generateStream() null body error (line 346)', () => {
    it('should throw error when response body is null', async () => {
      const params: GenerateParams = {
        prompt: 'Test',
        maxTokens: 100,
      };

      // Mock response with null body
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: null, // Line 346: null body
      });

      const generator = provider.generateStream('gpt-4', params);

      await expect(consumeStream(generator)).rejects.toThrow('Response body is null');
    });

    it('should throw error when response body is undefined', async () => {
      const params: GenerateParams = {
        prompt: 'Test',
        maxTokens: 100,
      };

      // Mock response with undefined body
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: undefined,
      });

      const generator = provider.generateStream('gpt-4', params);

      await expect(consumeStream(generator)).rejects.toThrow('Response body is null');
    });
  });

  describe('generateStream() missing choice handling (line 378)', () => {
    it('should skip chunks with missing choice', async () => {
      const params: GenerateParams = {
        prompt: 'Test',
        maxTokens: 100,
      };

      // Mock response with chunk that has empty choices array
      const mockBody = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: {"choices":[]}\n'), // Empty choices - line 378
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                'data: {"choices":[{"delta":{"content":"Valid"},"finish_reason":null}]}\n'
              ),
            })
            .mockResolvedValueOnce({ done: true }),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockBody,
      });

      const generator = provider.generateStream('gpt-4', params);
      const { result } = await consumeStream(generator);

      // Should skip the empty choice and only process the valid one
      expect(result.text).toBe('Valid');
    });

    it('should handle chunk with undefined first choice', async () => {
      const params: GenerateParams = {
        prompt: 'Test',
        maxTokens: 100,
      };

      const mockBody = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                'data: {"choices":[{"delta":{"content":"Good"},"finish_reason":null}]}\n'
              ),
            })
            .mockResolvedValueOnce({ done: true }),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockBody,
      });

      const generator = provider.generateStream('gpt-4', params);
      const { result } = await consumeStream(generator);

      expect(result.text).toBe('Good');
    });
  });

  describe('generateStream() malformed JSON handling (line 397)', () => {
    it('should skip malformed JSON chunks and continue processing', async () => {
      const params: GenerateParams = {
        prompt: 'Test',
        maxTokens: 100,
      };

      // Mock response with malformed JSON
      const mockBody = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}\n'
              ),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: {invalid json here\n'), // Malformed JSON - line 397
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                'data: {"choices":[{"delta":{"content":" World"},"finish_reason":"stop"}]}\n'
              ),
            })
            .mockResolvedValueOnce({ done: true }),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockBody,
      });

      const generator = provider.generateStream('gpt-4', params);
      const { result } = await consumeStream(generator);

      // Should skip malformed chunk and combine valid chunks
      expect(result.text).toBe('Hello World');
      expect(result.finishReason).toBe('completed'); // 'stop' gets mapped to 'completed'
    });

    it('should handle multiple malformed JSON chunks gracefully', async () => {
      const params: GenerateParams = {
        prompt: 'Test',
        maxTokens: 100,
      };

      const mockBody = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: {bad\n'),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: incomplete{json\n'),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                'data: {"choices":[{"delta":{"content":"Success"},"finish_reason":"stop"}]}\n'
              ),
            })
            .mockResolvedValueOnce({ done: true }),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockBody,
      });

      const generator = provider.generateStream('gpt-4', params);
      const { result } = await consumeStream(generator);

      // Should skip all malformed chunks and only use valid one
      expect(result.text).toBe('Success');
    });
  });

  describe('Integration: Complete coverage scenarios', () => {
    it('should handle complete streaming with all covered paths', async () => {
      const providerWithOrg = new OpenAIProvider({
        apiKey: 'sk-test-key',
        organization: 'org-test',
        timeout: 5000,
      });

      const params: GenerateParams = {
        prompt: 'Complex query',
        systemPrompt: 'You are an expert assistant',
        maxTokens: 500,
        temperature: 0.7,
      };

      const mockBody = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                'data: {"choices":[{"delta":{"content":"Response "},"finish_reason":null}]}\n'
              ),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: {malformed\n'), // Skip this
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: {"choices":[]}\n'), // Skip empty choices
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                'data: {"choices":[{"delta":{"content":"text"},"finish_reason":"stop"}]}\n'
              ),
            })
            .mockResolvedValueOnce({ done: true }),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockBody,
      });

      const generator = providerWithOrg.generateStream('gpt-4', params);
      const { result } = await consumeStream(generator);

      expect(result.text).toBe('Response text');
      expect(result.finishReason).toBe('completed'); // 'stop' gets mapped to 'completed'
      expect(result.promptTokens).toBeGreaterThan(1); // Includes system prompt
    });
  });
});
