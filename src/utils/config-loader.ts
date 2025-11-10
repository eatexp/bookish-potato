/**
 * Configuration Loader
 *
 * Loads and validates YAML configuration files for routing and provider settings.
 * Supports all router types (simple, cost-aware, api-first) and provider configurations.
 */

import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { SimpleRouterConfig } from '../routers/simple-router';
import { CostAwareRouterConfig } from '../routers/cost-aware-router';
import { APIFirstRouterConfig } from '../routers/api-first-router';
import { ProviderFactoryConfig } from './provider-factory';

/**
 * Complete configuration schema
 */
export interface WorkbenchConfig {
  /** Router type to use */
  router: {
    type: 'simple' | 'cost-aware' | 'api-first';
    /** Simple router configuration */
    simple?: SimpleRouterConfig;
    /** Cost-aware router configuration */
    costAware?: CostAwareRouterConfig;
    /** API-first router configuration */
    apiFirst?: APIFirstRouterConfig;
  };
  /** Provider configurations */
  providers?: ProviderFactoryConfig;
  /** Default routing options */
  defaults?: {
    /** Default temperature for inference */
    temperature?: number;
    /** Default max tokens */
    maxTokens?: number;
    /** Enable streaming by default */
    stream?: boolean;
  };
}

/**
 * Load configuration from YAML file
 *
 * @param configPath - Path to YAML config file
 * @returns Parsed and validated configuration
 * @throws Error if file doesn't exist or is invalid
 */
export function loadConfig(configPath: string): WorkbenchConfig {
  // Check if file exists
  if (!fs.existsSync(configPath)) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }

  // Read file
  const fileContent = fs.readFileSync(configPath, 'utf8');

  // Parse YAML
  let rawConfig: unknown;
  try {
    rawConfig = yaml.load(fileContent);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse YAML: ${error.message}`);
    }
    throw new Error('Failed to parse YAML: Unknown error');
  }

  // Validate structure
  if (!rawConfig || typeof rawConfig !== 'object') {
    throw new Error('Configuration must be a valid YAML object');
  }

  const config = rawConfig as Record<string, unknown>;

  // Validate router configuration
  if (!config['router'] || typeof config['router'] !== 'object') {
    throw new Error('Configuration must include "router" section');
  }

  const router = config['router'] as Record<string, unknown>;
  if (!router['type'] || typeof router['type'] !== 'string') {
    throw new Error('Router configuration must include "type" field');
  }

  const routerType = router['type'];
  if (!['simple', 'cost-aware', 'api-first'].includes(routerType)) {
    throw new Error(
      `Invalid router type: ${routerType}. Must be one of: simple, cost-aware, api-first`
    );
  }

  // Validate router-specific config
  validateRouterConfig(routerType, router);

  // Return typed config (validated above)
  return config as unknown as WorkbenchConfig;
}

/**
 * Validate router-specific configuration
 */
function validateRouterConfig(type: string, router: Record<string, unknown>): void {
  switch (type) {
    case 'cost-aware': {
      const costAware = router['costAware'] as Record<string, unknown> | undefined;
      if (!costAware) {
        throw new Error('Cost-aware router requires "costAware" configuration section');
      }
      if (typeof costAware['monthlyBudget'] !== 'number') {
        throw new Error('Cost-aware router requires "monthlyBudget" (number)');
      }
      if (costAware['monthlyBudget'] <= 0) {
        throw new Error('monthlyBudget must be greater than 0');
      }
      break;
    }
    case 'simple': {
      // Simple router config is optional, validate if present
      const simple = router['simple'] as Record<string, unknown> | undefined;
      if (simple) {
        if (simple['defaultModel'] && typeof simple['defaultModel'] !== 'string') {
          throw new Error('simple.defaultModel must be a string');
        }
        if (simple['defaultProvider'] && typeof simple['defaultProvider'] !== 'string') {
          throw new Error('simple.defaultProvider must be a string');
        }
      }
      break;
    }
    case 'api-first': {
      // API-first router config is optional, validate if present
      const apiFirst = router['apiFirst'] as Record<string, unknown> | undefined;
      if (apiFirst) {
        if (apiFirst['defaultModel'] && typeof apiFirst['defaultModel'] !== 'string') {
          throw new Error('apiFirst.defaultModel must be a string');
        }
        if (apiFirst['defaultProvider'] && typeof apiFirst['defaultProvider'] !== 'string') {
          throw new Error('apiFirst.defaultProvider must be a string');
        }
        if (
          apiFirst['fallbackToLocal'] !== undefined &&
          typeof apiFirst['fallbackToLocal'] !== 'boolean'
        ) {
          throw new Error('apiFirst.fallbackToLocal must be a boolean');
        }
      }
      break;
    }
  }
}

/**
 * Load configuration with environment variable expansion
 *
 * Expands ${ENV_VAR} syntax in string values
 *
 * @param configPath - Path to YAML config file
 * @returns Parsed configuration with expanded environment variables
 */
export function loadConfigWithEnv(configPath: string): WorkbenchConfig {
  const config = loadConfig(configPath);

  // Expand environment variables in provider configs
  if (config.providers) {
    expandEnvVars(config.providers);
  }

  return config;
}

/**
 * Recursively expand environment variables in object
 */
function expandEnvVars(obj: unknown): void {
  if (!obj || typeof obj !== 'object') {
    return;
  }

  const record = obj as Record<string, unknown>;
  for (const key in record) {
    const value = record[key];

    if (typeof value === 'string') {
      // Replace ${ENV_VAR} with process.env['ENV_VAR']
      record[key] = value.replace(/\$\{([^}]+)\}/g, (_match, envVar: string) => {
        return process.env[envVar] || '';
      });
    } else if (typeof value === 'object' && value !== null) {
      expandEnvVars(value);
    }
  }
}

/**
 * Get default configuration example as YAML string
 *
 * @returns Example configuration in YAML format
 */
export function getDefaultConfigYAML(): string {
  return `# Hybrid AI Workbench Configuration

# Router configuration
router:
  type: cost-aware  # Options: simple | cost-aware | api-first

  # Cost-aware router settings (used when type is 'cost-aware')
  costAware:
    monthlyBudget: 100.00         # Monthly API budget limit in USD
    defaultLocal: qwen3-coder-30b # Default local model
    complexityThreshold: 0.8      # Complexity threshold for API escalation (0-1)
    tokenThreshold: 16000         # Token threshold for API escalation

  # Simple router settings (used when type is 'simple')
  # simple:
  #   defaultModel: qwen3-coder-30b
  #   defaultProvider: ollama

  # API-first router settings (used when type is 'api-first')
  # apiFirst:
  #   defaultModel: claude-opus-4
  #   defaultProvider: anthropic
  #   fallbackToLocal: true
  #   localFallbackModel: qwen3-coder-30b

# Provider configurations
providers:
  ollama:
    baseUrl: http://localhost:11434
    timeout: 120000  # 2 minutes

  anthropic:
    apiKey: \${ANTHROPIC_API_KEY}  # Use environment variable
    timeout: 120000

  openai:
    apiKey: \${OPENAI_API_KEY}
    timeout: 120000
    # organization: org-123  # Optional

# Default inference parameters
defaults:
  temperature: 0.7
  maxTokens: 4096
  stream: false
`;
}
