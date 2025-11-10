/**
 * Unit tests for provider-factory
 *
 * Tests the factory functions for creating and checking model providers
 */

import { createProvider, isProviderAvailable, getAvailableProviders } from '../../src/utils/provider-factory';
import { OllamaProvider } from '../../src/providers/ollama-provider';
import { AnthropicProvider } from '../../src/providers/anthropic-provider';
import { OpenAIProvider } from '../../src/providers/openai-provider';

// Mock fetch for API calls
global.fetch = jest.fn();

describe('provider-factory', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock for Ollama /api/tags endpoint
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ models: [{ name: 'llama2' }] }),
    });
  });

  describe('createProvider()', () => {
    it('should create Ollama provider', () => {
      const provider = createProvider('ollama', {
        ollama: { baseUrl: 'http://localhost:11434' },
      });

      expect(provider).toBeInstanceOf(OllamaProvider);
      expect(provider.name).toBe('ollama');
      expect(provider.type).toBe('local');
    });

    it('should create Anthropic provider with API key', () => {
      const provider = createProvider('anthropic', {
        anthropic: { apiKey: 'sk-ant-test' },
      });

      expect(provider).toBeInstanceOf(AnthropicProvider);
      expect(provider.name).toBe('anthropic');
      expect(provider.type).toBe('api');
    });

    it('should create OpenAI provider with API key', () => {
      const provider = createProvider('openai', {
        openai: { apiKey: 'sk-test' },
      });

      expect(provider).toBeInstanceOf(OpenAIProvider);
      expect(provider.name).toBe('openai');
      expect(provider.type).toBe('api');
    });

    it('should throw error for unknown provider', () => {
      expect(() => {
        createProvider('unknown-provider' as any);
      }).toThrow('Unknown provider: unknown-provider');
    });

    it('should use environment variables when config not provided', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-env-test';

      const provider = createProvider('anthropic');

      expect(provider).toBeInstanceOf(AnthropicProvider);

      delete process.env.ANTHROPIC_API_KEY;
    });

    it('should throw error when Anthropic API key is missing', () => {
      delete process.env.ANTHROPIC_API_KEY;

      expect(() => {
        createProvider('anthropic', {});
      }).toThrow('Anthropic API key not found');
    });

    it('should throw error when OpenAI API key is missing', () => {
      delete process.env.OPENAI_API_KEY;

      expect(() => {
        createProvider('openai', {});
      }).toThrow('OpenAI API key not found');
    });
  });

  describe('isProviderAvailable()', () => {
    it('should return true for available Ollama provider', async () => {
      // Mock Ollama /api/tags endpoint
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [{ name: 'llama2' }] }),
      });

      const available = await isProviderAvailable('ollama', {
        ollama: { baseUrl: 'http://localhost:11434' },
      });

      expect(available).toBe(true);
    });

    it('should return true for available Anthropic provider', async () => {
      // Anthropic just checks API key format, no network call
      const available = await isProviderAvailable('anthropic', {
        anthropic: { apiKey: 'sk-ant-test' },
      });

      expect(available).toBe(true);
    });

    it('should return false when provider creation fails', async () => {
      // Try to create provider without required API key
      const available = await isProviderAvailable('anthropic', {});

      expect(available).toBe(false);
    });

    it('should return false for unknown provider', async () => {
      const available = await isProviderAvailable('unknown-provider' as any);

      expect(available).toBe(false);
    });

    it('should return false when provider isAvailable throws error', async () => {
      // Mock Ollama to throw error
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Connection failed'));

      const available = await isProviderAvailable('ollama', {
        ollama: { baseUrl: 'http://localhost:11434' },
      });

      expect(available).toBe(false);
    });

    it('should handle provider that returns false for isAvailable', async () => {
      // Mock Ollama /api/tags to fail
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Service Unavailable',
      });

      const available = await isProviderAvailable('ollama', {
        ollama: { baseUrl: 'http://localhost:11434' },
      });

      expect(available).toBe(false);
    });
  });

  describe('getAvailableProviders()', () => {
    it('should return all providers when all are available', async () => {
      // Only Ollama makes network call (to /api/tags)
      // Anthropic and OpenAI just check API key format
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [{ name: 'llama2' }] }),
      });

      const available = await getAvailableProviders({
        ollama: { baseUrl: 'http://localhost:11434' },
        anthropic: { apiKey: 'sk-ant-test' },
        openai: { apiKey: 'sk-test' },
      });

      expect(available).toEqual(['ollama', 'anthropic', 'openai']);
    });

    it('should return only available providers when some fail', async () => {
      // Mock Ollama available
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [{ name: 'llama2' }] }),
      });

      const available = await getAvailableProviders({
        ollama: { baseUrl: 'http://localhost:11434' },
        // anthropic and openai configs missing - will fail creation
      });

      expect(available).toEqual(['ollama']);
    });

    it('should return only Ollama when others have no config', async () => {
      // Mock Ollama as available (doesn't need config)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [{ name: 'llama2' }] }),
      });

      const available = await getAvailableProviders({});

      // Ollama doesn't require configuration, so it should be available
      expect(available).toEqual(['ollama']);
    });

    it('should handle provider creation errors gracefully', async () => {
      // Mock Ollama available, others fail due to missing API keys
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [{ name: 'llama2' }] }),
      });

      const available = await getAvailableProviders({
        ollama: { baseUrl: 'http://localhost:11434' },
        // anthropic and openai configs missing - will fail
      });

      expect(available).toEqual(['ollama']);
    });

    it('should work with environment variables', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-env';
      process.env.OPENAI_API_KEY = 'sk-env';

      // Mock Ollama as available
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [{ name: 'llama2' }] }),
      });

      const available = await getAvailableProviders({
        ollama: { baseUrl: 'http://localhost:11434' },
      });

      expect(available).toEqual(['ollama', 'anthropic', 'openai']);

      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;
    });

    it('should handle Ollama network failures', async () => {
      // Mock Ollama network failure
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const available = await getAvailableProviders({
        ollama: { baseUrl: 'http://localhost:11434' },
        anthropic: { apiKey: 'sk-ant-test' },
        openai: { apiKey: 'sk-test' },
      });

      // Ollama failed, but Anthropic and OpenAI should still be available
      expect(available).toEqual(['anthropic', 'openai']);
    });
  });
});
