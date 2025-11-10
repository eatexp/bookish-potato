/**
 * Simulated GPU Provider (Tier 3) - ADR-003
 *
 * Provides simulated GPU metrics for RTX 5090 when no physical GPU is available.
 * Used primarily in CI/CD environments and for testing.
 *
 * WARNING: This provider returns fake metrics and should only be used when
 * real GPU access is unavailable. Always prefer NVML or nvidia-smi providers.
 */

import { BaseGPUProvider, GPUMetrics, HealthCheckResult } from '../core/gpu-provider';

export interface SimulatedGPUConfig {
  /** Device name to simulate (default: RTX 5090) */
  deviceName?: string;
  /** Total VRAM in GB (default: 32 for RTX 5090) */
  vramTotal?: number;
  /** Simulated VRAM usage in GB (default: 8 - 25% utilization) */
  vramUsed?: number;
  /** Compute capability (default: sm_120 for RTX 5090 Blackwell) */
  computeCapability?: string;
  /** Simulate varying metrics over time (default: false) */
  dynamic?: boolean;
}

export class SimulatedGPUProvider extends BaseGPUProvider {
  readonly name = 'Simulated';
  readonly tier = 3 as const;

  private config: Required<SimulatedGPUConfig>;
  private startTime: number;

  constructor(config: SimulatedGPUConfig = {}) {
    super();

    const vramTotal = config.vramTotal ?? 32;
    const vramUsed = config.vramUsed ?? 8;

    // Validate configuration
    if (vramTotal <= 0) {
      throw new Error(`Invalid vramTotal: ${vramTotal} (must be > 0)`);
    }
    if (vramUsed < 0) {
      throw new Error(`Invalid vramUsed: ${vramUsed} (must be >= 0)`);
    }
    if (vramUsed > vramTotal) {
      throw new Error(`Invalid vramUsed: ${vramUsed} exceeds vramTotal: ${vramTotal}`);
    }

    this.config = {
      deviceName: config.deviceName ?? 'NVIDIA GeForce RTX 5090',
      vramTotal,
      vramUsed,
      computeCapability: config.computeCapability ?? 'sm_120',
      dynamic: config.dynamic ?? false,
    };
    this.startTime = Date.now();
  }

  /**
   * Check if provider is available (always true for simulated)
   * @note Must be async to match GPUProvider interface
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async isAvailable(): Promise<boolean> {
    // Simulated provider is always available (fallback of last resort)
    return true;
  }

  /**
   * Get GPU metrics (static or dynamic based on config)
   * @note Must be async to match GPUProvider interface
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async getMetrics(): Promise<GPUMetrics> {
    const metrics = this.config.dynamic ? this.generateDynamicMetrics() : this.generateStaticMetrics();

    // Validate metrics before returning
    this.validateMetrics(metrics);

    return metrics;
  }

  /**
   * Health check (always healthy for simulated)
   * @note Must be async to match GPUProvider interface
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  override async healthCheck(): Promise<HealthCheckResult> {
    return {
      healthy: true,
      reason: 'Using simulated metrics (no physical GPU detected)',
      warnings: [
        'Simulated GPU provider is active - metrics are not real',
        'For production use, ensure NVML or nvidia-smi provider is available',
      ],
    };
  }

  /**
   * Generate static metrics (default behavior)
   */
  private generateStaticMetrics(): GPUMetrics {
    return {
      vramTotal: this.config.vramTotal,
      vramUsed: this.config.vramUsed,
      vramFree: this.config.vramTotal - this.config.vramUsed,
      computeCapability: this.config.computeCapability,
      deviceName: `${this.config.deviceName} (Simulated)`,
      temperature: 65,
      powerDraw: 350,
      clockSpeed: 2600,
      eccEnabled: true,
      pciThroughput: 128,
      utilizationGPU: 25,
      utilizationMemory: Math.round((this.config.vramUsed / this.config.vramTotal) * 100),
    };
  }

  /**
   * Generate dynamic metrics that vary over time
   * Useful for testing monitoring and alerting systems
   */
  private generateDynamicMetrics(): GPUMetrics {
    const elapsed = (Date.now() - this.startTime) / 1000; // seconds

    // Use sine waves for realistic variation
    const vramUsage = this.config.vramUsed + Math.sin(elapsed / 10) * 4; // ±4GB variation
    const temperature = 65 + Math.sin(elapsed / 5) * 10; // 55-75°C
    const powerDraw = 350 + Math.sin(elapsed / 7) * 100; // 250-450W
    const utilizationGPU = 25 + Math.sin(elapsed / 3) * 20; // 5-45%

    return {
      vramTotal: this.config.vramTotal,
      vramUsed: Math.max(0, Math.min(this.config.vramTotal, vramUsage)),
      vramFree: Math.max(0, this.config.vramTotal - vramUsage),
      computeCapability: this.config.computeCapability,
      deviceName: `${this.config.deviceName} (Simulated - Dynamic)`,
      temperature: Math.max(0, temperature),
      powerDraw: Math.max(0, powerDraw),
      clockSpeed: 2600 + Math.floor(Math.sin(elapsed / 4) * 200), // 2400-2800 MHz
      eccEnabled: true,
      pciThroughput: 128,
      utilizationGPU: Math.max(0, Math.min(100, utilizationGPU)),
      utilizationMemory: Math.round((vramUsage / this.config.vramTotal) * 100),
    };
  }
}
