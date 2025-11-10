/**
 * Integration test: Streaming Execution Workflow
 *
 * Tests the complete streaming workflow across all providers,
 * including real-time chunk processing and final result aggregation.
 */

import { OllamaProvider } from '../../src/providers/ollama-provider';
import { AnthropicProvider } from '../../src/providers/anthropic-provider';
import { OpenAIProvider } from '../../src/providers/openai-provider';

// Mock fetch for API calls
global.fetch = jest.fn();

describe('Integration: Streaming Execution Workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Ollama streaming workflow', () => {
    it('should stream chunks and return final result', async () => {
      const provider = new OllamaProvider({
        baseUrl: 'http://localhost:11434',
      });

      // Mock streaming response (newline-delimited JSON)
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
                    model: 'qwen3-coder-30b',
                    response: 'Hello',
                    done: false,
                  }) + '\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  JSON.stringify({
                    model: 'qwen3-coder-30b',
                    response: ' world',
                    done: false,
                  }) + '\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  JSON.stringify({
                    model: 'qwen3-coder-30b',
                    response: '!',
                    done: true,
                    prompt_eval_count: 10,
                    eval_count: 15,
                    total_duration: 2000000000,
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

      // Step 1: Start streaming
      const generator = provider.generateStream('qwen3-coder-30b', {
        prompt: 'Say hello',
      });

      // Step 2: Collect chunks using manual iteration to get return value
      const chunks: string[] = [];
      let finalResult;

      while (true) {
        const { value, done } = await generator.next();
        if (done) {
          // Generator is done, value is the return value (final InferenceResponse)
          finalResult = value;
          break;
        }
        // value is a yielded StreamChunk
        if ('done' in value) {
          chunks.push(value.text);
        }
      }

      // Step 3: Verify chunks received in order
      expect(chunks).toEqual(['Hello', ' world', '!']);

      // Step 4: Verify final result
      expect(finalResult).toBeDefined();
      expect(finalResult.text).toBe('Hello world!');
      expect(finalResult.model).toBe('qwen3-coder-30b');
      expect(finalResult.provider).toBe('ollama');
      expect(finalResult.finishReason).toBe('completed');
      expect(finalResult.promptTokens).toBe(10);
      expect(finalResult.completionTokens).toBe(15);
    });

    it('should accumulate full response text from chunks', async () => {
      const provider = new OllamaProvider({
        baseUrl: 'http://localhost:11434',
      });

      // Mock multi-chunk response
      const chunks = ['def ', 'hello', '_world', '():', '\n    ', 'print', '("Hello")'];
      const mockReads = chunks.map((chunk) =>
        jest.fn().mockResolvedValue({
          done: false,
          value: new TextEncoder().encode(
            JSON.stringify({
              model: 'qwen3-coder-30b',
              response: chunk,
              done: false,
            }) + '\n'
          ),
        })
      );

      // Add final chunk
      mockReads.push(
        jest.fn().mockResolvedValue({
          done: false,
          value: new TextEncoder().encode(
            JSON.stringify({
              model: 'qwen3-coder-30b',
              response: '',
              done: true,
              prompt_eval_count: 5,
              eval_count: 20,
            }) + '\n'
          ),
        })
      );

      // Add done signal
      mockReads.push(
        jest.fn().mockResolvedValue({
          done: true,
        })
      );

      const mockResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: jest
              .fn()
              .mockImplementation(() => {
                const fn = mockReads.shift();
                return fn ? fn() : Promise.resolve({ done: true });
              }),
          }),
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const generator = provider.generateStream('qwen3-coder-30b', {
        prompt: 'Write hello world function',
      });

      let finalResult;
      while (true) {
        const { value, done } = await generator.next();
        if (done) {
          finalResult = value;
          break;
        }
      }

      expect(finalResult).toBeDefined();
      expect(finalResult.text).toBe('def hello_world():\n    print("Hello")');
    });
  });

  describe('Anthropic streaming workflow', () => {
    it('should stream SSE events and return final result', async () => {
      const provider = new AnthropicProvider({
        apiKey: 'sk-ant-test',
      });

      // Mock SSE streaming response
      const mockResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: jest
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'event: message_start\ndata: ' +
                    JSON.stringify({
                      type: 'message_start',
                      message: { id: 'msg_123', model: 'claude-opus-4' },
                    }) +
                    '\n\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'event: content_block_delta\ndata: ' +
                    JSON.stringify({
                      type: 'content_block_delta',
                      delta: { type: 'text_delta', text: 'Hello' },
                    }) +
                    '\n\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'event: content_block_delta\ndata: ' +
                    JSON.stringify({
                      type: 'content_block_delta',
                      delta: { type: 'text_delta', text: ' Claude' },
                    }) +
                    '\n\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'event: message_delta\ndata: ' +
                    JSON.stringify({
                      type: 'message_delta',
                      usage: { output_tokens: 15 },
                      delta: { stop_reason: 'end_turn' },
                    }) +
                    '\n\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'event: message_stop\ndata: {}\n\n'
                ),
              })
              .mockResolvedValueOnce({
                done: true,
              }),
          }),
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const generator = provider.generateStream('claude-opus-4', {
        prompt: 'Say hello',
      });

      const chunks: string[] = [];
      let finalResult;

      while (true) {
        const { value, done } = await generator.next();
        if (done) {
          finalResult = value;
          break;
        }
        if ('done' in value) {
          chunks.push(value.text);
        }
      }

      expect(chunks).toEqual(['Hello', ' Claude']);
      expect(finalResult).toBeDefined();
      expect(finalResult.text).toBe('Hello Claude');
      expect(finalResult.provider).toBe('anthropic');
      expect(finalResult.finishReason).toBe('completed');
    });
  });

  describe('OpenAI streaming workflow', () => {
    it('should stream completion chunks and return final result', async () => {
      const provider = new OpenAIProvider({
        apiKey: 'sk-test',
      });

      // Mock OpenAI SSE streaming
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
                      model: 'gpt-5',
                      choices: [
                        {
                          index: 0,
                          delta: { content: 'Hello' },
                          finish_reason: null,
                        },
                      ],
                    }) +
                    '\n\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: ' +
                    JSON.stringify({
                      id: 'chatcmpl-123',
                      object: 'chat.completion.chunk',
                      model: 'gpt-5',
                      choices: [
                        {
                          index: 0,
                          delta: { content: ' GPT' },
                          finish_reason: null,
                        },
                      ],
                    }) +
                    '\n\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: ' +
                    JSON.stringify({
                      id: 'chatcmpl-123',
                      object: 'chat.completion.chunk',
                      model: 'gpt-5',
                      choices: [
                        {
                          index: 0,
                          delta: {},
                          finish_reason: 'stop',
                        },
                      ],
                    }) +
                    '\n\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: [DONE]\n\n'),
              })
              .mockResolvedValueOnce({
                done: true,
              }),
          }),
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const generator = provider.generateStream('gpt-5', {
        prompt: 'Say hello',
      });

      const chunks: string[] = [];
      let finalResult;

      while (true) {
        const { value, done } = await generator.next();
        if (done) {
          finalResult = value;
          break;
        }
        if ('done' in value) {
          chunks.push(value.text);
        }
      }

      expect(chunks).toEqual(['Hello', ' GPT']);
      expect(finalResult).toBeDefined();
      expect(finalResult.text).toBe('Hello GPT');
      expect(finalResult.provider).toBe('openai');
      expect(finalResult.finishReason).toBe('completed');
    });
  });

  describe('Cross-provider streaming comparison', () => {
    it('should produce consistent results across providers', async () => {
      const expectedText = 'The quick brown fox';

      // Test Ollama
      const ollamaProvider = new OllamaProvider({
        baseUrl: 'http://localhost:11434',
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: jest
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  JSON.stringify({
                    response: expectedText,
                    done: true,
                    prompt_eval_count: 5,
                    eval_count: 10,
                  }) + '\n'
                ),
              })
              .mockResolvedValueOnce({ done: true }),
          }),
        },
      });

      const ollamaGen = ollamaProvider.generateStream('qwen3-coder-30b', {
        prompt: 'test',
      });
      let ollamaResult;
      while (true) {
        const { value, done } = await ollamaGen.next();
        if (done) {
          ollamaResult = value;
          break;
        }
      }

      expect(ollamaResult).toBeDefined();
      expect(ollamaResult.text).toBe(expectedText);

      // Test Anthropic
      const anthropicProvider = new AnthropicProvider({
        apiKey: 'sk-ant-test',
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: jest
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'event: content_block_delta\ndata: ' +
                    JSON.stringify({
                      type: 'content_block_delta',
                      delta: { type: 'text_delta', text: expectedText },
                    }) +
                    '\n\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'event: message_delta\ndata: ' +
                    JSON.stringify({
                      type: 'message_delta',
                      usage: { output_tokens: 10 },
                      delta: { stop_reason: 'end_turn' },
                    }) +
                    '\n\n'
                ),
              })
              .mockResolvedValueOnce({ done: true }),
          }),
        },
      });

      const anthropicGen = anthropicProvider.generateStream('claude-opus-4', {
        prompt: 'test',
      });
      let anthropicResult;
      while (true) {
        const { value, done } = await anthropicGen.next();
        if (done) {
          anthropicResult = value;
          break;
        }
      }

      expect(anthropicResult).toBeDefined();
      expect(anthropicResult.text).toBe(expectedText);

      // Test OpenAI
      const openaiProvider = new OpenAIProvider({
        apiKey: 'sk-test',
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
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
                      choices: [
                        {
                          delta: { content: expectedText },
                          finish_reason: null,
                        },
                      ],
                    }) +
                    '\n\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'data: ' +
                    JSON.stringify({
                      choices: [{ delta: {}, finish_reason: 'stop' }],
                    }) +
                    '\n\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: [DONE]\n\n'),
              })
              .mockResolvedValueOnce({ done: true }),
          }),
        },
      });

      const openaiGen = openaiProvider.generateStream('gpt-5', {
        prompt: 'test',
      });
      let openaiResult;
      while (true) {
        const { value, done } = await openaiGen.next();
        if (done) {
          openaiResult = value;
          break;
        }
      }

      expect(openaiResult).toBeDefined();
      expect(openaiResult.text).toBe(expectedText);

      // All providers should produce same text
      expect(ollamaResult.text).toBe(anthropicResult.text);
      expect(anthropicResult.text).toBe(openaiResult.text);
    });
  });

  describe('Streaming with parameters', () => {
    it('should pass inference parameters to streaming requests', async () => {
      const provider = new OllamaProvider({
        baseUrl: 'http://localhost:11434',
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: jest
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  JSON.stringify({ response: 'test', done: true }) + '\n'
                ),
              })
              .mockResolvedValueOnce({ done: true }),
          }),
        },
      });

      const generator = provider.generateStream('qwen3-coder-30b', {
        prompt: 'test',
        temperature: 0.9,
        maxTokens: 1000,
        topP: 0.95,
      });

      for await (const _ of generator) {
        // Consume generator
      }

      // Verify parameters were passed to API
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          body: expect.stringContaining('"temperature":0.9'),
        })
      );
    });
  });
});
