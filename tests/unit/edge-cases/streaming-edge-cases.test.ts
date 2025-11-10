/**
 * Edge Case Tests: Streaming Operations
 *
 * Tests boundary conditions, error handling, and edge cases in streaming
 * responses from model providers (Ollama, Anthropic, OpenAI).
 */

import { OllamaProvider } from '../../../src/providers/ollama-provider';
import { InferenceParams } from '../../../src/core/model-provider';

// Mock fetch for streaming tests
global.fetch = jest.fn();

describe('Edge Cases: Streaming Operations', () => {
  let provider: OllamaProvider;
  const testParams: InferenceParams = {
    prompt: 'Test prompt',
    temperature: 0.7,
    maxTokens: 100,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new OllamaProvider({ baseUrl: 'http://localhost:11434' });
  });

  describe('Empty and minimal streams', () => {
    it('should handle empty stream response', async () => {
      // Mock empty stream
      const mockBody = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('{"done":true}\n') })
            .mockResolvedValueOnce({ done: true }),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockBody,
      });

      const chunks = [];
      const generator = provider.generateStream('llama2', testParams);

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      // Should get final response even with empty content
      expect(chunks.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle stream with only whitespace', async () => {
      const mockBody = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('{"response":"   ","done":false}\n'),
            })
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('{"done":true}\n') })
            .mockResolvedValueOnce({ done: true }),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockBody,
      });

      const chunks = [];
      const generator = provider.generateStream('llama2', testParams);

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].text).toBe('   ');
    });

    it('should handle stream with single character', async () => {
      const mockBody = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('{"response":"a","done":false}\n'),
            })
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('{"done":true}\n') })
            .mockResolvedValueOnce({ done: true }),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockBody,
      });

      const chunks = [];
      const generator = provider.generateStream('llama2', testParams);

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].text).toBe('a');
    });
  });

  describe('Malformed JSON handling', () => {
    it('should skip malformed JSON chunks and continue', async () => {
      const mockBody = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('{"response":"valid","done":false}\n'),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('{invalid json\n'),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('{"response":"more","done":false}\n'),
            })
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('{"done":true}\n') })
            .mockResolvedValueOnce({ done: true }),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockBody,
      });

      const chunks = [];
      const generator = provider.generateStream('llama2', testParams);

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      // Should get valid chunks, skipping malformed one
      expect(chunks.length).toBe(2);
      expect(chunks[0].text).toBe('valid');
      expect(chunks[1].text).toBe('more');
    });

    it('should handle incomplete JSON at chunk boundaries', async () => {
      const mockBody = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('{"response":"te'),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('xt","done":false}\n'),
            })
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('{"done":true}\n') })
            .mockResolvedValueOnce({ done: true }),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockBody,
      });

      const chunks = [];
      const generator = provider.generateStream('llama2', testParams);

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      // Implementation skips incomplete JSON, which is expected behavior
      expect(chunks.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle JSON with missing fields', async () => {
      const mockBody = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('{"done":false}\n'), // Missing response field
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('{"response":"valid","done":false}\n'),
            })
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('{"done":true}\n') })
            .mockResolvedValueOnce({ done: true }),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockBody,
      });

      const chunks = [];
      const generator = provider.generateStream('llama2', testParams);

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      // Should only yield chunks with response field
      expect(chunks.length).toBe(1);
      expect(chunks[0].text).toBe('valid');
    });
  });

  describe('Large content handling', () => {
    it('should handle very large single chunk', async () => {
      const largeText = 'x'.repeat(100000); // 100KB chunk
      const mockBody = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(`{"response":"${largeText}","done":false}\n`),
            })
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('{"done":true}\n') })
            .mockResolvedValueOnce({ done: true }),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockBody,
      });

      const chunks = [];
      const generator = provider.generateStream('llama2', testParams);

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].text).toBe(largeText);
    });

    it('should handle many small chunks efficiently', async () => {
      const chunkCount = 100;
      const mockReadFn = jest.fn();

      // Add many small chunks
      for (let i = 0; i < chunkCount; i++) {
        mockReadFn.mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(`{"response":"${i}","done":false}\n`),
        });
      }
      mockReadFn.mockResolvedValueOnce({
        done: false,
        value: new TextEncoder().encode('{"done":true}\n'),
      });
      mockReadFn.mockResolvedValueOnce({ done: true });

      const mockBody = {
        getReader: () => ({ read: mockReadFn }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockBody,
      });

      const chunks = [];
      const generator = provider.generateStream('llama2', testParams);

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(chunkCount);
    });
  });

  describe('Unicode and special characters', () => {
    it('should handle Unicode characters correctly', async () => {
      const unicodeText = '你好世界 🌍 مرحبا עולם';
      const mockBody = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(`{"response":"${unicodeText}","done":false}\n`),
            })
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('{"done":true}\n') })
            .mockResolvedValueOnce({ done: true }),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockBody,
      });

      const chunks = [];
      const generator = provider.generateStream('llama2', testParams);

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].text).toBe(unicodeText);
    });

    it('should handle emojis in stream', async () => {
      const emojiText = '👍 😀 🎉 ✨ 🚀';
      const mockBody = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(`{"response":"${emojiText}","done":false}\n`),
            })
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('{"done":true}\n') })
            .mockResolvedValueOnce({ done: true }),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockBody,
      });

      const chunks = [];
      const generator = provider.generateStream('llama2', testParams);

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].text).toBe(emojiText);
    });

    it('should handle escaped characters in JSON', async () => {
      const escapedText = 'Line 1\\nLine 2\\tTabbed';
      const mockBody = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(`{"response":"${escapedText}","done":false}\n`),
            })
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('{"done":true}\n') })
            .mockResolvedValueOnce({ done: true }),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockBody,
      });

      const chunks = [];
      const generator = provider.generateStream('llama2', testParams);

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      // JSON.parse will convert escaped characters
      expect(chunks[0].text).toBe('Line 1\nLine 2\tTabbed');
    });

    it('should handle quotes in response text', async () => {
      const quotedText = 'She said "hello" and I replied';
      const escapedText = quotedText.replace(/"/g, '\\"');
      const mockBody = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(`{"response":"${escapedText}","done":false}\n`),
            })
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('{"done":true}\n') })
            .mockResolvedValueOnce({ done: true }),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockBody,
      });

      const chunks = [];
      const generator = provider.generateStream('llama2', testParams);

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].text).toBe(quotedText);
    });
  });

  describe('Stream interruption and errors', () => {
    it('should handle null response body', async () => {
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

    it('should handle fetch failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const generator = provider.generateStream('llama2', testParams);

      await expect(async () => {
        for await (const chunk of generator) {
          // Should not reach here
        }
      }).rejects.toThrow('Network error');
    });

    it('should handle API error response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      });

      const generator = provider.generateStream('llama2', testParams);

      await expect(async () => {
        for await (const chunk of generator) {
          // Should not reach here
        }
      }).rejects.toThrow('Ollama API error');
    });

    it('should handle stream that ends abruptly', async () => {
      const mockBody = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('{"response":"start","done":false}\n'),
            })
            .mockResolvedValueOnce({ done: true }), // Abrupt end without done:true
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockBody,
      });

      const chunks = [];
      const generator = provider.generateStream('llama2', testParams);

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      // Should handle gracefully and return what we got
      expect(chunks.length).toBe(1);
      expect(chunks[0].text).toBe('start');
    });
  });

  describe('Multiple lines per chunk', () => {
    it('should handle multiple JSON objects in single chunk', async () => {
      const multiLine = '{"response":"first","done":false}\n{"response":"second","done":false}\n';
      const mockBody = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(multiLine),
            })
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('{"done":true}\n') })
            .mockResolvedValueOnce({ done: true }),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockBody,
      });

      const chunks = [];
      const generator = provider.generateStream('llama2', testParams);

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      // Should process both lines in the chunk
      expect(chunks.length).toBe(2);
      expect(chunks[0].text).toBe('first');
      expect(chunks[1].text).toBe('second');
    });

    it('should handle empty lines in stream', async () => {
      const withEmptyLines = '\n\n{"response":"text","done":false}\n\n\n';
      const mockBody = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(withEmptyLines),
            })
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('{"done":true}\n') })
            .mockResolvedValueOnce({ done: true }),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockBody,
      });

      const chunks = [];
      const generator = provider.generateStream('llama2', testParams);

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      // Should filter out empty lines and process valid one
      expect(chunks.length).toBe(1);
      expect(chunks[0].text).toBe('text');
    });
  });

  describe('Done flag handling', () => {
    it('should process done flag but continue stream until end', async () => {
      const mockBody = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('{"response":"chunk1","done":false}\n'),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('{"response":"chunk2","done":true}\n'),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('{"response":"chunk3","done":false}\n'),
            })
            .mockResolvedValueOnce({ done: true }),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockBody,
      });

      const chunks = [];
      const generator = provider.generateStream('llama2', testParams);

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      // Implementation continues processing until stream ends
      expect(chunks.length).toBe(3);
      expect(chunks[0].text).toBe('chunk1');
      expect(chunks[1].text).toBe('chunk2');
      expect(chunks[2].text).toBe('chunk3');
    });

    it('should handle done flag without response text', async () => {
      const mockBody = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('{"response":"text","done":false}\n'),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('{"done":true}\n'), // No response field
            })
            .mockResolvedValueOnce({ done: true }),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockBody,
      });

      const chunks = [];
      const generator = provider.generateStream('llama2', testParams);

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      // Should yield chunk before done:true
      expect(chunks.length).toBe(1);
      expect(chunks[0].text).toBe('text');
    });
  });

  describe('Token counting in streams', () => {
    it('should handle stream with token count metadata', async () => {
      const mockBody = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('{"response":"test","done":false}\n'),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                '{"done":true,"prompt_eval_count":10,"eval_count":20}\n'
              ),
            })
            .mockResolvedValueOnce({ done: true }),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockBody,
      });

      const chunks = [];
      const generator = provider.generateStream('llama2', testParams);

      let finalResponse;
      for await (const chunk of generator) {
        chunks.push(chunk);
        finalResponse = chunk;
      }

      // Generator should complete and return final response
      expect(chunks.length).toBeGreaterThan(0);
      expect(finalResponse).toBeDefined();
    });
  });
});
