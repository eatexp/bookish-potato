/**
 * Model Provider Factory
 *
 * Creates model provider instances based on provider name and configuration.
 * Supports local (Ollama) and API (Anthropic, OpenAI) providers.
 */

import { ModelProvider } from '../core/model-provider';
import { OllamaProvider } from '../providers/ollama-provider';
import { AnthropicProvider } from '../providers/anthropic-provider';
import { OpenAIProvider } from '../providers/openai-provider';

/**
 * Configuration for all providers
 */
export interface ProviderFactoryConfig {
  /** Ollama configuration */
  ollama?: {
    baseUrl?: string;
    timeout?: number;
  };
  /** Anthropic configuration */
  anthropic?: {
    apiKey?: string;
    baseUrl?: string;
    timeout?: number;
  };
  /** OpenAI configuration */
  openai?: {
    apiKey?: string;
    baseUrl?: string;
    timeout?: number;
    organization?: string;
  };
}

/**
 * Default configuration from environment variables
 */
function getDefaultConfig(): ProviderFactoryConfig {
  return {
    ollama: {
      baseUrl: process.env['OLLAMA_BASE_URL'] || 'http://localhost:11434',
      timeout: process.env['OLLAMA_TIMEOUT']
        ? parseInt(process.env['OLLAMA_TIMEOUT'])
        : 120000,
    },
    anthropic: {
      apiKey: process.env['ANTHROPIC_API_KEY'],
      baseUrl: process.env['ANTHROPIC_BASE_URL'],
      timeout: process.env['ANTHROPIC_TIMEOUT']
        ? parseInt(process.env['ANTHROPIC_TIMEOUT'])
        : 120000,
    },
    openai: {
      apiKey: process.env['OPENAI_API_KEY'],
      baseUrl: process.env['OPENAI_BASE_URL'],
      timeout: process.env['OPENAI_TIMEOUT']
        ? parseInt(process.env['OPENAI_TIMEOUT'])
        : 120000,
      organization: process.env['OPENAI_ORGANIZATION'],
    },
  };
}

/**
 * Create a model provider instance
 *
 * @param providerName - Provider name (ollama, anthropic, openai)
 * @param config - Optional configuration override
 * @returns ModelProvider instance
 * @throws Error if provider is unknown or not configured
 */
export function createProvider(
  providerName: string,
  config?: ProviderFactoryConfig
): ModelProvider {
  const mergedConfig = { ...getDefaultConfig(), ...config };

  switch (providerName.toLowerCase()) {
    case 'ollama':
      return new OllamaProvider(mergedConfig.ollama);

    case 'anthropic':
      if (!mergedConfig.anthropic?.apiKey) {
        throw new Error(
          'Anthropic API key not found. Set ANTHROPIC_API_KEY environment variable or provide config.anthropic.apiKey'
        );
      }
      return new AnthropicProvider({
        apiKey: mergedConfig.anthropic.apiKey,
        baseUrl: mergedConfig.anthropic.baseUrl,
        timeout: mergedConfig.anthropic.timeout,
      });

    case 'openai':
      if (!mergedConfig.openai?.apiKey) {
        throw new Error(
          'OpenAI API key not found. Set OPENAI_API_KEY environment variable or provide config.openai.apiKey'
        );
      }
      return new OpenAIProvider({
        apiKey: mergedConfig.openai.apiKey,
        baseUrl: mergedConfig.openai.baseUrl,
        timeout: mergedConfig.openai.timeout,
        organization: mergedConfig.openai.organization,
      });

    default:
      throw new Error(
        `Unknown provider: ${providerName}. Supported providers: ollama, anthropic, openai`
      );
  }
}

/**
 * Check if a provider is available and configured
 *
 * @param providerName - Provider name to check
 * @param config - Optional configuration override
 * @returns Promise resolving to availability status
 */
export async function isProviderAvailable(
  providerName: string,
  config?: ProviderFactoryConfig
): Promise<boolean> {
  try {
    const provider = createProvider(providerName, config);
    return await provider.isAvailable();
  } catch (error) {
    return false;
  }
}

/**
 * Get list of all available providers
 *
 * @param config - Optional configuration override
 * @returns Promise resolving to array of available provider names
 */
export async function getAvailableProviders(
  config?: ProviderFactoryConfig
): Promise<string[]> {
  const providers = ['ollama', 'anthropic', 'openai'];
  const available: string[] = [];

  for (const provider of providers) {
    if (await isProviderAvailable(provider, config)) {
      available.push(provider);
    }
  }

  return available;
}
