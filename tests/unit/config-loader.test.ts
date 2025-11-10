/**
 * Unit tests for Configuration Loader
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  loadConfig,
  loadConfigWithEnv,
  getDefaultConfigYAML,
  WorkbenchConfig,
} from '../../src/utils/config-loader';

describe('ConfigLoader', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create temporary directory for test configs
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-test-'));
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('loadConfig', () => {
    it('should load valid cost-aware configuration', () => {
      const configPath = path.join(tempDir, 'config.yaml');
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
`;
      fs.writeFileSync(configPath, configContent);

      const config = loadConfig(configPath);

      expect(config.router.type).toBe('cost-aware');
      expect(config.router.costAware).toBeDefined();
      expect(config.router.costAware?.monthlyBudget).toBe(100);
      expect(config.router.costAware?.defaultLocal).toBe('qwen3-coder-30b');
      expect(config.providers?.ollama?.baseUrl).toBe('http://localhost:11434');
    });

    it('should load valid simple router configuration', () => {
      const configPath = path.join(tempDir, 'config.yaml');
      const configContent = `
router:
  type: simple
  simple:
    defaultModel: llama-3.1-70b
    defaultProvider: ollama
`;
      fs.writeFileSync(configPath, configContent);

      const config = loadConfig(configPath);

      expect(config.router.type).toBe('simple');
      expect(config.router.simple?.defaultModel).toBe('llama-3.1-70b');
      expect(config.router.simple?.defaultProvider).toBe('ollama');
    });

    it('should load valid api-first router configuration', () => {
      const configPath = path.join(tempDir, 'config.yaml');
      const configContent = `
router:
  type: api-first
  apiFirst:
    defaultModel: claude-opus-4
    defaultProvider: anthropic
    fallbackToLocal: true
    localFallbackModel: qwen3-coder-30b
`;
      fs.writeFileSync(configPath, configContent);

      const config = loadConfig(configPath);

      expect(config.router.type).toBe('api-first');
      expect(config.router.apiFirst?.defaultModel).toBe('claude-opus-4');
      expect(config.router.apiFirst?.fallbackToLocal).toBe(true);
    });

    it('should load configuration with defaults section', () => {
      const configPath = path.join(tempDir, 'config.yaml');
      const configContent = `
router:
  type: simple
defaults:
  temperature: 0.8
  maxTokens: 2048
  stream: true
`;
      fs.writeFileSync(configPath, configContent);

      const config = loadConfig(configPath);

      expect(config.defaults?.temperature).toBe(0.8);
      expect(config.defaults?.maxTokens).toBe(2048);
      expect(config.defaults?.stream).toBe(true);
    });

    it('should throw error for non-existent file', () => {
      expect(() => {
        loadConfig('/nonexistent/config.yaml');
      }).toThrow('Configuration file not found');
    });

    it('should throw error for invalid YAML', () => {
      const configPath = path.join(tempDir, 'invalid.yaml');
      fs.writeFileSync(configPath, 'invalid: yaml: content:\n  - broken');

      expect(() => {
        loadConfig(configPath);
      }).toThrow('Failed to parse YAML');
    });

    it('should throw error for missing router section', () => {
      const configPath = path.join(tempDir, 'no-router.yaml');
      fs.writeFileSync(configPath, 'providers:\n  ollama:\n    baseUrl: localhost');

      expect(() => {
        loadConfig(configPath);
      }).toThrow('Configuration must include "router" section');
    });

    it('should throw error for missing router type', () => {
      const configPath = path.join(tempDir, 'no-type.yaml');
      fs.writeFileSync(configPath, 'router:\n  costAware:\n    monthlyBudget: 100');

      expect(() => {
        loadConfig(configPath);
      }).toThrow('Router configuration must include "type" field');
    });

    it('should throw error for invalid router type', () => {
      const configPath = path.join(tempDir, 'invalid-type.yaml');
      fs.writeFileSync(configPath, 'router:\n  type: invalid-router');

      expect(() => {
        loadConfig(configPath);
      }).toThrow('Invalid router type: invalid-router');
    });

    it('should throw error for cost-aware without monthlyBudget', () => {
      const configPath = path.join(tempDir, 'no-budget.yaml');
      fs.writeFileSync(
        configPath,
        'router:\n  type: cost-aware\n  costAware:\n    defaultLocal: qwen3'
      );

      expect(() => {
        loadConfig(configPath);
      }).toThrow('Cost-aware router requires "monthlyBudget"');
    });

    it('should throw error for cost-aware with invalid monthlyBudget', () => {
      const configPath = path.join(tempDir, 'invalid-budget.yaml');
      fs.writeFileSync(
        configPath,
        'router:\n  type: cost-aware\n  costAware:\n    monthlyBudget: -10'
      );

      expect(() => {
        loadConfig(configPath);
      }).toThrow('monthlyBudget must be greater than 0');
    });

    it('should throw error for cost-aware without costAware section', () => {
      const configPath = path.join(tempDir, 'missing-section.yaml');
      fs.writeFileSync(configPath, 'router:\n  type: cost-aware');

      expect(() => {
        loadConfig(configPath);
      }).toThrow('Cost-aware router requires "costAware" configuration section');
    });

    it('should accept simple router without config section', () => {
      const configPath = path.join(tempDir, 'simple-minimal.yaml');
      fs.writeFileSync(configPath, 'router:\n  type: simple');

      const config = loadConfig(configPath);
      expect(config.router.type).toBe('simple');
    });

    it('should accept api-first router without config section', () => {
      const configPath = path.join(tempDir, 'api-first-minimal.yaml');
      fs.writeFileSync(configPath, 'router:\n  type: api-first');

      const config = loadConfig(configPath);
      expect(config.router.type).toBe('api-first');
    });

    it('should validate simple router defaultModel type', () => {
      const configPath = path.join(tempDir, 'simple-invalid.yaml');
      fs.writeFileSync(
        configPath,
        'router:\n  type: simple\n  simple:\n    defaultModel: 123'
      );

      expect(() => {
        loadConfig(configPath);
      }).toThrow('simple.defaultModel must be a string');
    });

    it('should validate apiFirst fallbackToLocal type', () => {
      const configPath = path.join(tempDir, 'api-first-invalid.yaml');
      fs.writeFileSync(
        configPath,
        'router:\n  type: api-first\n  apiFirst:\n    fallbackToLocal: "yes"'
      );

      expect(() => {
        loadConfig(configPath);
      }).toThrow('apiFirst.fallbackToLocal must be a boolean');
    });
  });

  describe('loadConfigWithEnv', () => {
    it('should expand environment variables in config', () => {
      const configPath = path.join(tempDir, 'env-config.yaml');
      const configContent = `
router:
  type: simple
providers:
  anthropic:
    apiKey: \${TEST_API_KEY}
  openai:
    apiKey: \${TEST_OPENAI_KEY}
`;
      fs.writeFileSync(configPath, configContent);

      // Set environment variables
      process.env['TEST_API_KEY'] = 'test-key-123';
      process.env['TEST_OPENAI_KEY'] = 'openai-key-456';

      const config = loadConfigWithEnv(configPath);

      expect(config.providers?.anthropic?.apiKey).toBe('test-key-123');
      expect(config.providers?.openai?.apiKey).toBe('openai-key-456');

      // Clean up
      delete process.env['TEST_API_KEY'];
      delete process.env['TEST_OPENAI_KEY'];
    });

    it('should handle missing environment variables', () => {
      const configPath = path.join(tempDir, 'missing-env.yaml');
      const configContent = `
router:
  type: simple
providers:
  anthropic:
    apiKey: \${MISSING_ENV_VAR}
`;
      fs.writeFileSync(configPath, configContent);

      const config = loadConfigWithEnv(configPath);

      // Missing env vars should expand to empty string
      expect(config.providers?.anthropic?.apiKey).toBe('');
    });

    it('should expand nested environment variables', () => {
      const configPath = path.join(tempDir, 'nested-env.yaml');
      const configContent = `
router:
  type: simple
providers:
  ollama:
    baseUrl: \${OLLAMA_URL}
    timeout: 120000
  anthropic:
    apiKey: \${ANTHROPIC_KEY}
    baseUrl: \${ANTHROPIC_URL}
`;
      fs.writeFileSync(configPath, configContent);

      process.env['OLLAMA_URL'] = 'http://gpu-server:11434';
      process.env['ANTHROPIC_KEY'] = 'sk-ant-123';
      process.env['ANTHROPIC_URL'] = 'https://api.anthropic.com/v1';

      const config = loadConfigWithEnv(configPath);

      expect(config.providers?.ollama?.baseUrl).toBe('http://gpu-server:11434');
      expect(config.providers?.anthropic?.apiKey).toBe('sk-ant-123');
      expect(config.providers?.anthropic?.baseUrl).toBe('https://api.anthropic.com/v1');

      delete process.env['OLLAMA_URL'];
      delete process.env['ANTHROPIC_KEY'];
      delete process.env['ANTHROPIC_URL'];
    });
  });

  describe('getDefaultConfigYAML', () => {
    it('should return valid YAML string', () => {
      const yaml = getDefaultConfigYAML();

      expect(yaml).toContain('router:');
      expect(yaml).toContain('type: cost-aware');
      expect(yaml).toContain('monthlyBudget:');
      expect(yaml).toContain('providers:');
      expect(yaml).toContain('defaults:');
    });

    it('should be parseable as valid YAML', () => {
      const yaml = getDefaultConfigYAML();
      const tempPath = path.join(tempDir, 'default.yaml');
      fs.writeFileSync(tempPath, yaml);

      // Should be able to load without errors
      const config = loadConfig(tempPath);
      expect(config.router.type).toBe('cost-aware');
    });
  });

  describe('complex configurations', () => {
    it('should handle complete configuration with all sections', () => {
      const configPath = path.join(tempDir, 'complete.yaml');
      const configContent = `
router:
  type: cost-aware
  costAware:
    monthlyBudget: 150
    defaultLocal: llama-3.1-70b
    complexityThreshold: 0.75
    tokenThreshold: 20000
  simple:
    defaultModel: qwen3-coder-30b
  apiFirst:
    defaultModel: gpt-5
providers:
  ollama:
    baseUrl: http://localhost:11434
    timeout: 180000
  anthropic:
    apiKey: sk-ant-test
    baseUrl: https://api.anthropic.com
    timeout: 120000
  openai:
    apiKey: sk-test-123
    organization: org-456
    timeout: 90000
defaults:
  temperature: 0.9
  maxTokens: 8192
  stream: true
`;
      fs.writeFileSync(configPath, configContent);

      const config = loadConfig(configPath);

      // Verify all sections loaded
      expect(config.router.type).toBe('cost-aware');
      expect(config.router.costAware?.monthlyBudget).toBe(150);
      expect(config.router.simple?.defaultModel).toBe('qwen3-coder-30b');
      expect(config.router.apiFirst?.defaultModel).toBe('gpt-5');
      expect(config.providers?.ollama?.timeout).toBe(180000);
      expect(config.providers?.anthropic?.apiKey).toBe('sk-ant-test');
      expect(config.providers?.openai?.organization).toBe('org-456');
      expect(config.defaults?.temperature).toBe(0.9);
      expect(config.defaults?.stream).toBe(true);
    });
  });
});
