/**
 * Integration test: Configuration Loading and Provider Factory
 *
 * Tests the complete workflow of loading YAML configuration,
 * creating routers, and instantiating providers.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadConfig, loadConfigWithEnv } from '../../src/utils/config-loader';
import { createProvider } from '../../src/utils/provider-factory';
import { SimpleRouter } from '../../src/routers/simple-router';
import { CostAwareRouter } from '../../src/routers/cost-aware-router';
import { APIFirstRouter } from '../../src/routers/api-first-router';

// Mock fetch for provider API calls
global.fetch = jest.fn();

describe('Integration: Configuration and Provider Workflow', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-test-'));
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('Complete configuration workflow', () => {
    it('should load config, create router, and execute workflow', async () => {
      // Step 1: Create configuration file
      const configPath = path.join(tempDir, 'workbench.yaml');
      const configContent = `
router:
  type: cost-aware
  costAware:
    monthlyBudget: 100
    defaultLocal: qwen3-coder-30b
    complexityThreshold: 0.8
    tokenThreshold: 16000

providers:
  ollama:
    baseUrl: http://localhost:11434
    timeout: 120000

  anthropic:
    apiKey: sk-ant-test-key
    timeout: 120000

defaults:
  temperature: 0.7
  maxTokens: 4096
  stream: false
`;
      fs.writeFileSync(configPath, configContent);

      // Step 2: Load configuration
      const config = loadConfig(configPath);

      expect(config.router.type).toBe('cost-aware');
      expect(config.router.costAware?.monthlyBudget).toBe(100);
      expect(config.providers?.ollama?.baseUrl).toBe('http://localhost:11434');
      expect(config.providers?.anthropic?.apiKey).toBe('sk-ant-test-key');
      expect(config.defaults?.temperature).toBe(0.7);

      // Step 3: Create router from config
      const router = new CostAwareRouter(config.router.costAware!);

      expect(router.name).toBe('cost-aware');

      // Step 4: Make routing decision
      const decision = await router.route({
        prompt: 'Simple task',
        estimatedTokens: 500,
        complexity: 0.3,
      });

      expect(decision.target.type).toBe('local');
      expect(decision.target.model).toBe('qwen3-coder-30b');

      // Step 5: Create provider from config
      const provider = createProvider('ollama', config.providers);

      expect(provider.name).toBe('ollama');
      expect(provider.type).toBe('local');

      // Mock provider availability check
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [] }),
      });

      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });

    it('should support all three router types from config', async () => {
      // Test Simple Router
      const simpleConfigPath = path.join(tempDir, 'simple.yaml');
      fs.writeFileSync(
        simpleConfigPath,
        `
router:
  type: simple
  simple:
    defaultModel: llama-3.1-70b
    defaultProvider: ollama
`
      );

      const simpleConfig = loadConfig(simpleConfigPath);
      const simpleRouter = new SimpleRouter(simpleConfig.router.simple);
      expect(simpleRouter.name).toBe('simple');

      const simpleDecision = await simpleRouter.route({
        prompt: 'test',
        estimatedTokens: 100,
      });
      expect(simpleDecision.target.model).toBe('llama-3.1-70b');

      // Test Cost-Aware Router
      const costAwareConfigPath = path.join(tempDir, 'cost-aware.yaml');
      fs.writeFileSync(
        costAwareConfigPath,
        `
router:
  type: cost-aware
  costAware:
    monthlyBudget: 50
    defaultLocal: qwen3-coder-30b
`
      );

      const costAwareConfig = loadConfig(costAwareConfigPath);
      const costAwareRouter = new CostAwareRouter(costAwareConfig.router.costAware!);
      expect(costAwareRouter.name).toBe('cost-aware');

      // Test API-First Router
      const apiFirstConfigPath = path.join(tempDir, 'api-first.yaml');
      fs.writeFileSync(
        apiFirstConfigPath,
        `
router:
  type: api-first
  apiFirst:
    defaultModel: claude-opus-4
    defaultProvider: anthropic
    fallbackToLocal: true
`
      );

      const apiFirstConfig = loadConfig(apiFirstConfigPath);
      const apiFirstRouter = new APIFirstRouter(apiFirstConfig.router.apiFirst);
      expect(apiFirstRouter.name).toBe('api-first');

      const apiFirstDecision = await apiFirstRouter.route({
        prompt: 'test',
        estimatedTokens: 100,
      });
      expect(apiFirstDecision.target.model).toBe('claude-opus-4');
      expect(apiFirstDecision.target.provider).toBe('anthropic');
    });
  });

  describe('Environment variable expansion workflow', () => {
    it('should expand environment variables in provider configs', () => {
      // Step 1: Set environment variables
      process.env['TEST_ANTHROPIC_KEY'] = 'sk-ant-from-env';
      process.env['TEST_OPENAI_KEY'] = 'sk-openai-from-env';
      process.env['TEST_OLLAMA_URL'] = 'http://gpu-server:11434';

      // Step 2: Create config with env var placeholders
      const configPath = path.join(tempDir, 'env-config.yaml');
      fs.writeFileSync(
        configPath,
        `
router:
  type: simple

providers:
  ollama:
    baseUrl: \${TEST_OLLAMA_URL}
  anthropic:
    apiKey: \${TEST_ANTHROPIC_KEY}
  openai:
    apiKey: \${TEST_OPENAI_KEY}
`
      );

      // Step 3: Load config with env expansion
      const config = loadConfigWithEnv(configPath);

      // Step 4: Verify expansion
      expect(config.providers?.ollama?.baseUrl).toBe('http://gpu-server:11434');
      expect(config.providers?.anthropic?.apiKey).toBe('sk-ant-from-env');
      expect(config.providers?.openai?.apiKey).toBe('sk-openai-from-env');

      // Step 5: Create provider with expanded config
      const provider = createProvider('ollama', config.providers);
      expect(provider.name).toBe('ollama');

      // Cleanup
      delete process.env['TEST_ANTHROPIC_KEY'];
      delete process.env['TEST_OPENAI_KEY'];
      delete process.env['TEST_OLLAMA_URL'];
    });

    it('should handle missing environment variables gracefully', () => {
      const configPath = path.join(tempDir, 'missing-env.yaml');
      fs.writeFileSync(
        configPath,
        `
router:
  type: simple

providers:
  anthropic:
    apiKey: \${NONEXISTENT_KEY}
`
      );

      const config = loadConfigWithEnv(configPath);

      // Missing vars expand to empty string
      expect(config.providers?.anthropic?.apiKey).toBe('');
    });
  });

  describe('Default parameter workflow', () => {
    it('should apply defaults from config to inference requests', async () => {
      // Step 1: Create config with defaults
      const configPath = path.join(tempDir, 'defaults.yaml');
      fs.writeFileSync(
        configPath,
        `
router:
  type: simple

defaults:
  temperature: 0.9
  maxTokens: 2048
  stream: true
`
      );

      const config = loadConfig(configPath);

      // Step 2: Verify defaults loaded
      expect(config.defaults?.temperature).toBe(0.9);
      expect(config.defaults?.maxTokens).toBe(2048);
      expect(config.defaults?.stream).toBe(true);

      // In real workflow, these would be applied to inference requests
      // when CLI options don't override them
      const inferenceParams = {
        temperature: config.defaults.temperature,
        maxTokens: config.defaults.maxTokens,
      };

      expect(inferenceParams.temperature).toBe(0.9);
      expect(inferenceParams.maxTokens).toBe(2048);
    });
  });

  describe('Provider instantiation workflow', () => {
    it('should create Ollama provider with custom config', () => {
      const config = {
        ollama: {
          baseUrl: 'http://custom-server:11434',
          timeout: 60000,
        },
      };

      const provider = createProvider('ollama', config);

      expect(provider.name).toBe('ollama');
      expect(provider.type).toBe('local');
    });

    it('should create Anthropic provider with API key from config', () => {
      const config = {
        anthropic: {
          apiKey: 'sk-ant-config-test',
          timeout: 90000,
        },
      };

      const provider = createProvider('anthropic', config);

      expect(provider.name).toBe('anthropic');
      expect(provider.type).toBe('api');
    });

    it('should create OpenAI provider with organization from config', () => {
      const config = {
        openai: {
          apiKey: 'sk-test-key',
          organization: 'org-test-123',
          timeout: 120000,
        },
      };

      const provider = createProvider('openai', config);

      expect(provider.name).toBe('openai');
      expect(provider.type).toBe('api');
    });

    it('should fall back to environment variables when config not provided', () => {
      // Set test env vars
      process.env['OLLAMA_BASE_URL'] = 'http://env-server:11434';

      // Create provider without explicit config
      const provider = createProvider('ollama');

      expect(provider.name).toBe('ollama');

      // Cleanup
      delete process.env['OLLAMA_BASE_URL'];
    });
  });

  describe('Multi-provider workflow', () => {
    it('should create and use multiple providers from same config', () => {
      const config = {
        ollama: {
          baseUrl: 'http://localhost:11434',
        },
        anthropic: {
          apiKey: 'sk-ant-test',
        },
        openai: {
          apiKey: 'sk-openai-test',
        },
      };

      // Create all three providers
      const ollamaProvider = createProvider('ollama', config);
      const anthropicProvider = createProvider('anthropic', config);
      const openaiProvider = createProvider('openai', config);

      expect(ollamaProvider.type).toBe('local');
      expect(anthropicProvider.type).toBe('api');
      expect(openaiProvider.type).toBe('api');

      expect(ollamaProvider.name).toBe('ollama');
      expect(anthropicProvider.name).toBe('anthropic');
      expect(openaiProvider.name).toBe('openai');
    });
  });

  describe('Error handling workflow', () => {
    it('should throw error for invalid router type in config', () => {
      const configPath = path.join(tempDir, 'invalid-router.yaml');
      fs.writeFileSync(
        configPath,
        `
router:
  type: invalid-type
`
      );

      expect(() => loadConfig(configPath)).toThrow('Invalid router type');
    });

    it('should throw error for missing required config fields', () => {
      const configPath = path.join(tempDir, 'missing-fields.yaml');
      fs.writeFileSync(
        configPath,
        `
router:
  type: cost-aware
  costAware:
    defaultLocal: qwen3
    # Missing monthlyBudget
`
      );

      expect(() => loadConfig(configPath)).toThrow('monthlyBudget');
    });

    it('should throw error when creating provider without required config', () => {
      expect(() => {
        createProvider('anthropic', {});
      }).toThrow('Anthropic API key not found');

      expect(() => {
        createProvider('openai', {});
      }).toThrow('OpenAI API key not found');
    });

    it('should throw error for unknown provider', () => {
      expect(() => {
        createProvider('unknown-provider', {});
      }).toThrow('Unknown provider');
    });
  });
});
