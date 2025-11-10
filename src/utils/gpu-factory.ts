/**
 * Factory functions for creating GPU detectors with all available providers
 */

import { GPUDetector, DockerAwareGPUDetector } from '../core/gpu-detector';
import { SimulatedGPUProvider, SimulatedGPUConfig } from '../providers/simulated-gpu-provider';
import { NvidiaSMIProvider, NvidiaSMIConfig } from '../providers/nvidia-smi-provider';
import { NVMLProvider, NVMLConfig } from '../providers/nvml-provider';
import { GPUProvider } from '../core/gpu-provider';

export interface GPUFactoryOptions {
  /** Configuration for NVML provider (Tier 1) */
  nvml?: NVMLConfig;
  /** Configuration for nvidia-smi provider (Tier 2) */
  nvidiaSmi?: NvidiaSMIConfig;
  /** Configuration for simulated provider (Tier 3) */
  simulated?: SimulatedGPUConfig;
  /** Whether to use Docker-aware detection (default: true) */
  dockerAware?: boolean;
}

/**
 * Create a GPU detector with all available providers
 * Providers are tried in order: NVML → nvidia-smi → Simulated
 *
 * @param options Configuration options for providers
 * @returns Initialized GPU detector
 *
 * @example
 * ```typescript
 * const detector = await createGPUDetector();
 * const metrics = await detector.getMetrics();
 * console.log(`GPU: ${metrics.deviceName}, VRAM: ${metrics.vramTotal} GB`);
 * ```
 */
export async function createGPUDetector(options: GPUFactoryOptions = {}): Promise<GPUDetector> {
  const providers: GPUProvider[] = [
    new NVMLProvider(options.nvml),
    new NvidiaSMIProvider(options.nvidiaSmi),
    new SimulatedGPUProvider(options.simulated),
  ];

  // Use Docker-aware detection by default
  const dockerAware = options.dockerAware ?? true;

  if (dockerAware) {
    const detector = await DockerAwareGPUDetector.create(providers);
    await detector.initialize();
    return detector;
  }

  const detector = new GPUDetector(providers);
  await detector.initialize();
  return detector;
}

/**
 * Create a simple GPU detector without Docker-aware reordering
 * Always tries providers in order: NVML → nvidia-smi → Simulated
 */
export async function createSimpleGPUDetector(options: GPUFactoryOptions = {}): Promise<GPUDetector> {
  return createGPUDetector({ ...options, dockerAware: false });
}
