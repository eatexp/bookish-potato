// Main entry point for programmatic use
// CLI users should use the 'hybrid-ai-workbench' binary instead

// Core abstractions
export type { GPUMetrics, GPUProvider, HealthCheckResult } from './core/gpu-provider';
export { GPUDetector, DockerAwareGPUDetector } from './core/gpu-detector';
export type {
  InferenceRequest,
  ModelTarget,
  RouteDecision,
  RoutingOptions,
  ModelRouter,
  ModelPricing,
} from './core/model-router';
export type {
  ModelProvider,
  InferenceParams,
  InferenceResponse,
  StreamChunk,
  ProviderHealth,
  LocalProviderConfig,
  APIProviderConfig,
} from './core/model-provider';
// export { HardeningCheck, CheckResult } from './core/hardening-check';

// GPU Providers
export { SimulatedGPUProvider } from './providers/simulated-gpu-provider';
export type { SimulatedGPUConfig } from './providers/simulated-gpu-provider';
export { NvidiaSMIProvider } from './providers/nvidia-smi-provider';
export type { NvidiaSMIConfig } from './providers/nvidia-smi-provider';
export { NVMLProvider } from './providers/nvml-provider';
export type { NVMLConfig } from './providers/nvml-provider';

// Model Providers
export { OllamaProvider } from './providers/ollama-provider';
export { AnthropicProvider } from './providers/anthropic-provider';
export { OpenAIProvider } from './providers/openai-provider';

// Model Routers
export { SimpleRouter } from './routers/simple-router';
export type { SimpleRouterConfig } from './routers/simple-router';
export { CostAwareRouter } from './routers/cost-aware-router';
export type { CostAwareRouterConfig } from './routers/cost-aware-router';
export { APIFirstRouter } from './routers/api-first-router';
export type { APIFirstRouterConfig } from './routers/api-first-router';

// Utilities
export { createGPUDetector } from './utils/gpu-factory';
export { CostTracker, getCostTracker } from './utils/cost-tracker';
export type { CostEntry, MonthlySummary } from './utils/cost-tracker';

// Version
export const VERSION = '0.1.0';
