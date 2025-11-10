/**
 * Edge Case Tests: Provider Errors
 *
 * Tests error handling, network failures, HTTP errors, and edge cases
 * in provider API calls for Ollama, Anthropic, and OpenAI providers.
 */

import { OllamaProvider } from '../../../src/providers/ollama-provider';
import { AnthropicProvider } from '../../../src/providers/anthropic-provider';
import { OpenAIProvider } from '../../../src/providers/openai-provider';
import { InferenceParams } from '../../../src/core/model-provider';

// Mock fetch for provider error tests
global.fetch = jest.fn();

describe('Edge Cases: Provider Errors', () => {
  const testParams: InferenceParams = {
    prompt: 'Test prompt',
    temperature: 0.7,
    maxTokens: 100,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Network errors', () => {
    it('should handle connection refused (ECONNREFUSED)', async () => {
      const provider = new OllamaProvider({ baseUrl: 'http://localhost:11434' });

      (global.fetch as jest.Mock).mockRejectedValue(
        Object.assign(new Error('fetch failed'), { code: 'ECONNREFUSED' })
      );

      await expect(provider.generate('llama2', testParams)).rejects.toThrow();
    });

    it('should handle timeout (ETIMEDOUT)', async () => {
      const provider = new OllamaProvider({ baseUrl: 'http://localhost:11434' });

      (global.fetch as jest.Mock).mockRejectedValue(
        Object.assign(new Error('fetch failed'), { code: 'ETIMEDOUT' })
      );

      await expect(provider.generate('llama2', testParams)).rejects.toThrow();
    });

    it('should handle DNS lookup failures (ENOTFOUND)', async () => {
      const provider = new OllamaProvider({ baseUrl: 'http://nonexistent.local:11434' });

      (global.fetch as jest.Mock).mockRejectedValue(
        Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' })
      );

      await expect(provider.generate('llama2', testParams)).rejects.toThrow();
    });

    it('should handle network unreachable', async () => {
      const provider = new OllamaProvider({ baseUrl: 'http://localhost:11434' });

      (global.fetch as jest.Mock).mockRejectedValue(
        Object.assign(new Error('Network unreachable'), { code: 'ENETUNREACH' })
      );

      await expect(provider.generate('llama2', testParams)).rejects.toThrow();
    });

    it('should handle AbortController timeout', async () => {
      const provider = new OllamaProvider({ baseUrl: 'http://localhost:11434', timeout: 100 });

      // Mock a slow response that triggers timeout
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(resolve, 200); // Exceeds 100ms timeout
          })
      );

      await expect(provider.generate('llama2', testParams)).rejects.toThrow();
    });
  });

  describe('HTTP error responses', () => {
    describe('Client errors (4xx)', () => {
      it('should handle 400 Bad Request', async () => {
        const provider = new OllamaProvider({ baseUrl: 'http://localhost:11434' });

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status: 400,
          text: async () => 'Invalid request format',
        });

        await expect(provider.generate('llama2', testParams)).rejects.toThrow('Ollama API error');
      });

      it('should handle 401 Unauthorized', async () => {
        const provider = new AnthropicProvider({ apiKey: 'invalid-key' });

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status: 401,
          json: async () => ({
            error: { type: 'authentication_error', message: 'Invalid API key' },
          }),
        });

        await expect(provider.generate('claude-opus-4', testParams)).rejects.toThrow(
          'Invalid API key'
        );
      });

      it('should handle 403 Forbidden', async () => {
        const provider = new OpenAIProvider({ apiKey: 'sk-valid-but-no-access' });

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status: 403,
          json: async () => ({
            error: { message: 'Access forbidden for this resource' },
          }),
        });

        await expect(provider.generate('gpt-4', testParams)).rejects.toThrow('Access forbidden');
      });

      it('should handle 404 Not Found (model not available)', async () => {
        const provider = new OllamaProvider({ baseUrl: 'http://localhost:11434' });

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status: 404,
          text: async () => 'Model not found',
        });

        await expect(provider.generate('nonexistent-model', testParams)).rejects.toThrow(
          'Ollama API error'
        );
      });

      it('should handle 429 Rate Limit Exceeded', async () => {
        const provider = new AnthropicProvider({ apiKey: 'sk-ant-test' });

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status: 429,
          json: async () => ({
            error: {
              type: 'rate_limit_error',
              message: 'Rate limit exceeded. Please try again later.',
            },
          }),
        });

        await expect(provider.generate('claude-opus-4', testParams)).rejects.toThrow(
          'Rate limit exceeded'
        );
      });
    });

    describe('Server errors (5xx)', () => {
      it('should handle 500 Internal Server Error', async () => {
        const provider = new OpenAIProvider({ apiKey: 'sk-test' });

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => ({
            error: { message: 'Internal server error' },
          }),
        });

        await expect(provider.generate('gpt-4', testParams)).rejects.toThrow(
          'Internal server error'
        );
      });

      it('should handle 502 Bad Gateway', async () => {
        const provider = new OllamaProvider({ baseUrl: 'http://localhost:11434' });

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status: 502,
          text: async () => 'Bad Gateway',
        });

        await expect(provider.generate('llama2', testParams)).rejects.toThrow('Ollama API error');
      });

      it('should handle 503 Service Unavailable', async () => {
        const provider = new AnthropicProvider({ apiKey: 'sk-ant-test' });

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status: 503,
          json: async () => ({
            error: {
              type: 'overloaded_error',
              message: 'Service temporarily unavailable',
            },
          }),
        });

        await expect(provider.generate('claude-opus-4', testParams)).rejects.toThrow(
          'Service temporarily unavailable'
        );
      });
    });
  });

  describe('Authentication errors', () => {
    it('should throw error when Anthropic API key is missing', () => {
      expect(() => {
        new AnthropicProvider({ apiKey: '' });
      }).toThrow('Anthropic API key is required');
    });

    it('should throw error when OpenAI API key is missing', () => {
      expect(() => {
        new OpenAIProvider({ apiKey: '' });
      }).toThrow('OpenAI API key is required');
    });

    it('should handle malformed API key format', async () => {
      const provider = new AnthropicProvider({ apiKey: 'invalid-format' });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            type: 'authentication_error',
            message: 'Invalid API key format',
          },
        }),
      });

      await expect(provider.generate('claude-opus-4', testParams)).rejects.toThrow(
        'Invalid API key format'
      );
    });

    it('should handle expired API keys', async () => {
      const provider = new OpenAIProvider({ apiKey: 'sk-expired-key' });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: { message: 'API key expired' },
        }),
      });

      await expect(provider.generate('gpt-4', testParams)).rejects.toThrow('API key expired');
    });
  });

  describe('Malformed API responses', () => {
    it('should handle non-JSON response when JSON expected', async () => {
      const provider = new OllamaProvider({ baseUrl: 'http://localhost:11434' });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON');
        },
      });

      await expect(provider.generate('llama2', testParams)).rejects.toThrow();
    });

    it('should handle missing required fields in response', async () => {
      const provider = new OllamaProvider({ baseUrl: 'http://localhost:11434' });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}), // Missing required fields
      });

      // Should handle gracefully with defaults or throw descriptive error
      await expect(provider.generate('llama2', testParams)).rejects.toThrow();
    });

    it('should handle response with unexpected data types gracefully', async () => {
      const provider = new OllamaProvider({ baseUrl: 'http://localhost:11434' });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          response: 12345, // Number instead of string
          done: true,
        }),
      });

      // Provider doesn't validate types strictly, returns result with coerced values
      const result = await provider.generate('llama2', testParams);
      expect(result.text).toBe(12345); // Coerced to number
      expect(result.completionTokens).toBeNaN(); // Can't estimate tokens from number
    });

    it('should handle null response body', async () => {
      const provider = new OllamaProvider({ baseUrl: 'http://localhost:11434' });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => null,
      });

      await expect(provider.generate('llama2', testParams)).rejects.toThrow();
    });
  });

  describe('Error message extraction', () => {
    it('should extract error message from Anthropic error object', async () => {
      const provider = new AnthropicProvider({ apiKey: 'sk-ant-test' });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            type: 'invalid_request_error',
            message: 'Invalid parameter: max_tokens must be <= 4096',
          },
        }),
      });

      await expect(provider.generate('claude-opus-4', testParams)).rejects.toThrow(
        'max_tokens must be <= 4096'
      );
    });

    it('should extract error message from OpenAI error object', async () => {
      const provider = new OpenAIProvider({ apiKey: 'sk-test' });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            message: 'Invalid model specified',
            type: 'invalid_request_error',
          },
        }),
      });

      await expect(provider.generate('gpt-4', testParams)).rejects.toThrow(
        'Invalid model specified'
      );
    });

    it('should handle error as string instead of object', async () => {
      const provider = new AnthropicProvider({ apiKey: 'sk-ant-test' });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          error: 'Unexpected server error',
        }),
      });

      await expect(provider.generate('claude-opus-4', testParams)).rejects.toThrow(
        'Unexpected server error'
      );
    });

    it('should fallback to HTTP status when no error message', async () => {
      const provider = new OpenAIProvider({ apiKey: 'sk-test' });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 418,
        json: async () => ({}),
      });

      await expect(provider.generate('gpt-4', testParams)).rejects.toThrow('HTTP 418');
    });
  });

  describe('List models errors', () => {
    it('should handle listModels failure for Ollama', async () => {
      const provider = new OllamaProvider({ baseUrl: 'http://localhost:11434' });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: 'Service Unavailable',
      });

      await expect(provider.listModels()).rejects.toThrow('Failed to list models');
    });

    it('should handle network error in listModels', async () => {
      const provider = new OllamaProvider({ baseUrl: 'http://localhost:11434' });

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(provider.listModels()).rejects.toThrow('Failed to list Ollama models');
    });
  });

  describe('isAvailable errors', () => {
    it('should return false when Ollama is not available', async () => {
      const provider = new OllamaProvider({ baseUrl: 'http://localhost:11434' });

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Connection refused'));

      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });

    it('should return false when Anthropic API key is invalid format', async () => {
      const provider = new AnthropicProvider({ apiKey: 'invalid' });

      const available = await provider.isAvailable();
      // Anthropic checks format, not network
      expect(available).toBe(false);
    });

    it('should return false when OpenAI API key is invalid format', async () => {
      const provider = new OpenAIProvider({ apiKey: 'invalid' });

      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });
  });

  describe('Streaming errors', () => {
    it('should handle null body in stream response', async () => {
      const provider = new OllamaProvider({ baseUrl: 'http://localhost:11434' });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: null,
      });

      const generator = provider.generateStream('llama2', testParams);

      await expect(async () => {
        for await (const chunk of generator) {
          // Should not reach here
        }
      }).rejects.toThrow('Response body is null');
    });

    it('should handle fetch failure in streaming', async () => {
      const provider = new AnthropicProvider({ apiKey: 'sk-ant-test' });

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network timeout'));

      const generator = provider.generateStream('claude-opus-4', testParams);

      await expect(async () => {
        for await (const chunk of generator) {
          // Should not reach here
        }
      }).rejects.toThrow('Network timeout');
    });

    it('should handle HTTP error in streaming', async () => {
      const provider = new OpenAIProvider({ apiKey: 'sk-test' });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({
          error: { message: 'Service overloaded' },
        }),
      });

      const generator = provider.generateStream('gpt-4', testParams);

      await expect(async () => {
        for await (const chunk of generator) {
          // Should not reach here
        }
      }).rejects.toThrow('Service overloaded');
    });
  });

  describe('Edge case error scenarios', () => {
    it('should handle empty error response', async () => {
      const provider = new OllamaProvider({ baseUrl: 'http://localhost:11434' });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => '',
      });

      await expect(provider.generate('llama2', testParams)).rejects.toThrow('Ollama API error');
    });

    it('should handle very long error messages', async () => {
      const provider = new OpenAIProvider({ apiKey: 'sk-test' });
      const longMessage = 'Error: ' + 'x'.repeat(10000);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: { message: longMessage },
        }),
      });

      await expect(provider.generate('gpt-4', testParams)).rejects.toThrow();
    });

    it('should handle error with special characters', async () => {
      const provider = new AnthropicProvider({ apiKey: 'sk-ant-test' });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            message: 'Invalid character: "\\n" in prompt',
          },
        }),
      });

      await expect(provider.generate('claude-opus-4', testParams)).rejects.toThrow(
        'Invalid character'
      );
    });

    it('should handle concurrent error scenarios', async () => {
      const provider = new OllamaProvider({ baseUrl: 'http://localhost:11434' });

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Connection pool exhausted'));

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(provider.generate('llama2', testParams).catch((e) => e));
      }

      const results = await Promise.all(promises);
      expect(results.every((r) => r instanceof Error)).toBe(true);
    });
  });
});
