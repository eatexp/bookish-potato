/* eslint-disable no-console */
// Console output is intentional for debugging GPU detection
/**
 * GPU Detector - ADR-003
 *
 * Automatically selects the best available GPU provider with fallback chain:
 * NVML (Tier 1) → nvidia-smi (Tier 2) → Simulated (Tier 3)
 */

import { GPUProvider, GPUMetrics, HealthCheckResult } from './gpu-provider';
import { promises as fs } from 'fs';

export class GPUDetector {
  private provider: GPUProvider | null = null;
  private providers: GPUProvider[] = [];

  /**
   * Initialize detector with a list of providers in priority order
   * @param providers List of providers to try (highest priority first)
   */
  constructor(providers: GPUProvider[]) {
    this.providers = providers;
  }

  /**
   * Initialize by selecting the first available provider
   * @throws Error if no providers are available (should never happen with Simulated fallback)
   */
  async initialize(): Promise<void> {
    for (const provider of this.providers) {
      const available = await provider.isAvailable();
      if (available) {
        this.provider = provider;
        console.log(`[GPU Detector] Selected provider: ${provider.name} (Tier ${provider.tier})`);
        return;
      }
    }

    throw new Error(
      'No GPU provider available. This should never happen with SimulatedGPUProvider fallback.'
    );
  }

  /**
   * Get current GPU metrics
   * Automatically initializes if not already initialized
   */
  async getMetrics(): Promise<GPUMetrics> {
    if (!this.provider) {
      await this.initialize();
    }
    return this.provider!.getMetrics();
  }

  /**
   * Get provider name for debugging/logging
   */
  getProviderName(): string {
    return this.provider?.name ?? 'Not initialized';
  }

  /**
   * Get provider tier (1=NVML, 2=nvidia-smi, 3=simulated)
   */
  getProviderTier(): number | null {
    return this.provider?.tier ?? null;
  }

  /**
   * Health check for monitoring
   */
  async healthCheck(): Promise<HealthCheckResult> {
    if (!this.provider) {
      await this.initialize();
    }
    return this.provider!.healthCheck();
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.provider && this.provider.cleanup) {
      await this.provider.cleanup();
    }
  }

  /**
   * Detect if running in Docker container
   * Used to adjust provider priority (nvidia-smi preferred in Docker)
   */
  static async isDocker(): Promise<boolean> {
    try {
      await fs.access('/.dockerenv');
      return true;
    } catch {
      // Check for cgroup hints
      try {
        const cgroup = await fs.readFile('/proc/1/cgroup', 'utf8');
        return cgroup.includes('docker') || cgroup.includes('lxc');
      } catch {
        return false;
      }
    }
  }

  /**
   * Detect if running in WSL2
   */
  static async isWSL(): Promise<boolean> {
    try {
      const version = await fs.readFile('/proc/version', 'utf8');
      return version.toLowerCase().includes('microsoft') || version.toLowerCase().includes('wsl');
    } catch {
      return false;
    }
  }
}

/**
 * Docker-aware GPU detector that adjusts provider priority
 * In Docker, nvidia-smi is often more reliable than NVML
 */
export class DockerAwareGPUDetector extends GPUDetector {
  /**
   * Create detector with environment-aware provider ordering
   */
  static async create(providers: GPUProvider[]): Promise<DockerAwareGPUDetector> {
    const isDocker = await GPUDetector.isDocker();
    const isWSL = await GPUDetector.isWSL();

    // Reorder providers based on environment
    let orderedProviders = [...providers];

    if (isDocker || isWSL) {
      // In Docker/WSL, prefer nvidia-smi (Tier 2) over NVML (Tier 1)
      // as NVML bindings can be unreliable
      orderedProviders = providers.sort((a, b) => {
        // Simulated always last
        if (a.tier === 3) {return 1;}
        if (b.tier === 3) {return -1;}
        // Prefer Tier 2 (nvidia-smi) in containerized environments
        if (a.tier === 2 && b.tier === 1) {return -1;}
        if (a.tier === 1 && b.tier === 2) {return 1;}
        return 0;
      });

      console.log(
        `[GPU Detector] Detected ${isDocker ? 'Docker' : 'WSL'} environment - prioritizing nvidia-smi`
      );
    }

    return new DockerAwareGPUDetector(orderedProviders);
  }
}
