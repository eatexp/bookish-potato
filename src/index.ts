// Main entry point for programmatic use
// CLI users should use the 'hybrid-ai-workbench' binary instead

// Core abstractions
export type { GPUMetrics, GPUProvider, HealthCheckResult } from './core/gpu-provider';
export { GPUDetector, DockerAwareGPUDetector } from './core/gpu-detector';
// export { ModelRouter, RouteDecision } from './core/model-router';
// export { HardeningCheck, CheckResult } from './core/hardening-check';

// GPU Providers
export { SimulatedGPUProvider } from './providers/simulated-gpu-provider';
export type { SimulatedGPUConfig } from './providers/simulated-gpu-provider';
export { NvidiaSMIProvider } from './providers/nvidia-smi-provider';
export type { NvidiaSMIConfig } from './providers/nvidia-smi-provider';
export { NVMLProvider } from './providers/nvml-provider';
export type { NVMLConfig } from './providers/nvml-provider';

// Routers (will be implemented in later tasks)
// export { SimpleRouter } from './routers/simple-router';
// export { CostAwareRouter } from './routers/cost-aware-router';
// export { APIFirstRouter } from './routers/api-first-router';

// Utilities
export { createGPUDetector } from './utils/gpu-factory';

// Version
export const VERSION = '0.1.0';
