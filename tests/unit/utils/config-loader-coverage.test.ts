/**
 * Coverage Tests for config-loader.ts
 *
 * Targets uncovered lines: 66, 71, 126, 136, 139, 177
 * Focuses on error paths and edge cases in configuration validation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { loadConfig, loadConfigWithEnv } from '../../../src/utils/config-loader';
import * as yaml from 'js-yaml';

// Mock yaml module
jest.mock('js-yaml');
const mockedYaml = yaml as jest.Mocked<typeof yaml>;

describe('config-loader: Coverage Tests', () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-test-'));
    configPath = path.join(tempDir, 'config.yaml');
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('YAML parsing errors', () => {
    it('should handle non-Error exception in YAML parsing (line 66)', async () => {
      // Create a config file
      await fs.writeFile(configPath, 'invalid: yaml: content:', 'utf-8');

      // Mock yaml.load to throw a non-Error exception (string)
      mockedYaml.load.mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw 'String error instead of Error object';
      });

      try {
        await loadConfig(configPath);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Failed to parse YAML: Unknown error');
      }
    });

    it('should handle Error exception in YAML parsing normally', async () => {
      await fs.writeFile(configPath, 'invalid: yaml: content:', 'utf-8');

      mockedYaml.load.mockImplementation(() => {
        throw new Error('Bad indentation at line 1');
      });

      try {
        await loadConfig(configPath);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Failed to parse YAML: Bad indentation at line 1');
      }
    });
  });

  describe('Invalid config object types (line 71)', () => {
    it('should reject null config', async () => {
      await fs.writeFile(configPath, '', 'utf-8');

      mockedYaml.load.mockReturnValue(null);

      try {
        await loadConfig(configPath);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Configuration must be a valid YAML object');
      }
    });

    it('should reject string config', async () => {
      await fs.writeFile(configPath, 'just a string', 'utf-8');

      mockedYaml.load.mockReturnValue('just a string');

      try {
        await loadConfig(configPath);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Configuration must be a valid YAML object');
      }
    });

    it('should reject number config', async () => {
      await fs.writeFile(configPath, '42', 'utf-8');

      mockedYaml.load.mockReturnValue(42);

      try {
        await loadConfig(configPath);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Configuration must be a valid YAML object');
      }
    });

    it('should reject array config', async () => {
      await fs.writeFile(configPath, '- item1\n- item2', 'utf-8');

      mockedYaml.load.mockReturnValue(['item1', 'item2']);

      try {
        await loadConfig(configPath);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Configuration must include "router" section');
      }
    });
  });

  describe('Simple router config validation (line 126)', () => {
    it('should reject simple router with invalid defaultProvider type (line 126)', async () => {
      await fs.writeFile(configPath, '', 'utf-8');

      mockedYaml.load.mockReturnValue({
        router: {
          type: 'simple',
          simple: {
            defaultModel: 'llama2',
            defaultProvider: 123, // Invalid: number instead of string
          },
        },
        providers: [],
      });

      try {
        await loadConfig(configPath);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('simple.defaultProvider must be a string');
      }
    });

    it('should reject simple router with invalid defaultModel type', async () => {
      await fs.writeFile(configPath, '', 'utf-8');

      mockedYaml.load.mockReturnValue({
        router: {
          type: 'simple',
          simple: {
            defaultModel: true, // Invalid: boolean instead of string
            defaultProvider: 'ollama',
          },
        },
        providers: [],
      });

      try {
        await loadConfig(configPath);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('simple.defaultModel must be a string');
      }
    });

    it('should accept simple router with valid string config', async () => {
      await fs.writeFile(configPath, '', 'utf-8');

      mockedYaml.load.mockReturnValue({
        router: {
          type: 'simple',
          simple: {
            defaultModel: 'llama2',
            defaultProvider: 'ollama',
          },
        },
        providers: [],
      });

      const config = await loadConfig(configPath);
      expect(config.router.type).toBe('simple');
    });
  });

  describe('API-first router config validation (lines 136, 139)', () => {
    it('should reject apiFirst router with invalid defaultModel type (line 136)', async () => {
      await fs.writeFile(configPath, '', 'utf-8');

      mockedYaml.load.mockReturnValue({
        router: {
          type: 'api-first',
          apiFirst: {
            defaultModel: ['array', 'of', 'strings'], // Invalid: array instead of string
            defaultProvider: 'anthropic',
          },
        },
        providers: [],
      });

      try {
        await loadConfig(configPath);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('apiFirst.defaultModel must be a string');
      }
    });

    it('should reject apiFirst router with invalid defaultProvider type (line 139)', async () => {
      await fs.writeFile(configPath, '', 'utf-8');

      mockedYaml.load.mockReturnValue({
        router: {
          type: 'api-first',
          apiFirst: {
            defaultModel: 'claude-opus-4',
            defaultProvider: { nested: 'object' }, // Invalid: object instead of string
          },
        },
        providers: [],
      });

      try {
        await loadConfig(configPath);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('apiFirst.defaultProvider must be a string');
      }
    });

    it('should reject apiFirst router with invalid fallbackToLocal type', async () => {
      await fs.writeFile(configPath, '', 'utf-8');

      mockedYaml.load.mockReturnValue({
        router: {
          type: 'api-first',
          apiFirst: {
            defaultModel: 'gpt-5',
            defaultProvider: 'openai',
            fallbackToLocal: 'yes', // Invalid: string instead of boolean
          },
        },
        providers: [],
      });

      try {
        await loadConfig(configPath);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('apiFirst.fallbackToLocal must be a boolean');
      }
    });

    it('should accept apiFirst router with valid config', async () => {
      await fs.writeFile(configPath, '', 'utf-8');

      mockedYaml.load.mockReturnValue({
        router: {
          type: 'api-first',
          apiFirst: {
            defaultModel: 'claude-opus-4',
            defaultProvider: 'anthropic',
            fallbackToLocal: true,
          },
        },
        providers: [],
      });

      const config = await loadConfig(configPath);
      expect(config.router.type).toBe('api-first');
    });
  });

  describe('expandEnvVars edge cases (line 177)', () => {
    it('should handle non-object values in expandEnvVars (line 177)', async () => {
      // Create a config with providers that will be expanded
      await fs.writeFile(
        configPath,
        `
router:
  type: simple
providers:
  - name: ollama
    type: ollama
    baseUrl: \${OLLAMA_URL}
    primitiveValue: 42
    stringValue: "test"
    boolValue: true
    nullValue: null
`,
        'utf-8'
      );

      // Don't mock yaml.load for this test - use real YAML parsing
      jest.unmock('js-yaml');
      jest.resetModules();

      // Import fresh module
      const { loadConfigWithEnv: loadConfigWithEnvReal } = await import('../../../src/utils/config-loader');

      // Set environment variable
      process.env.OLLAMA_URL = 'http://localhost:11434';

      const config = await loadConfigWithEnvReal(configPath);

      // Should successfully load and expand env vars
      expect(config.router.type).toBe('simple');

      // Clean up
      delete process.env.OLLAMA_URL;
    });

    it('should handle deeply nested objects with primitives', async () => {
      await fs.writeFile(
        configPath,
        `
router:
  type: cost-aware
  costAware:
    monthlyBudget: 100
providers:
  - name: anthropic
    type: anthropic
    apiKey: \${ANTHROPIC_API_KEY}
    nested:
      level1:
        level2:
          value: 123
          text: "test"
`,
        'utf-8'
      );

      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';

      // Use real module for this test
      jest.unmock('js-yaml');
      jest.resetModules();
      const { loadConfigWithEnv: loadConfigWithEnvReal } = await import('../../../src/utils/config-loader');

      const config = await loadConfigWithEnvReal(configPath);

      expect(config.router.type).toBe('cost-aware');

      // Clean up
      delete process.env.ANTHROPIC_API_KEY;
    });
  });

  describe('Additional validation edge cases', () => {
    it('should reject cost-aware router with zero monthlyBudget', async () => {
      await fs.writeFile(configPath, '', 'utf-8');

      mockedYaml.load.mockReturnValue({
        router: {
          type: 'cost-aware',
          costAware: {
            monthlyBudget: 0, // Invalid: must be > 0
          },
        },
        providers: [],
      });

      try {
        await loadConfig(configPath);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('monthlyBudget must be greater than 0');
      }
    });

    it('should reject cost-aware router with negative monthlyBudget', async () => {
      await fs.writeFile(configPath, '', 'utf-8');

      mockedYaml.load.mockReturnValue({
        router: {
          type: 'cost-aware',
          costAware: {
            monthlyBudget: -50,
          },
        },
        providers: [],
      });

      try {
        await loadConfig(configPath);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('monthlyBudget must be greater than 0');
      }
    });

    it('should accept simple router without simple config section', async () => {
      await fs.writeFile(configPath, '', 'utf-8');

      mockedYaml.load.mockReturnValue({
        router: {
          type: 'simple',
          // No simple section - should be valid
        },
        providers: [],
      });

      const config = await loadConfig(configPath);
      expect(config.router.type).toBe('simple');
    });

    it('should accept api-first router without apiFirst config section', async () => {
      await fs.writeFile(configPath, '', 'utf-8');

      mockedYaml.load.mockReturnValue({
        router: {
          type: 'api-first',
          // No apiFirst section - should be valid
        },
        providers: [],
      });

      const config = await loadConfig(configPath);
      expect(config.router.type).toBe('api-first');
    });
  });
});
