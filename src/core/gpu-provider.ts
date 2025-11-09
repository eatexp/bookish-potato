/**
 * GPU Abstraction Layer - ADR-003
 *
 * Defines core interfaces for GPU metrics and providers.
 * Supports three-tier fallback: NVML → nvidia-smi → simulated
 */

/**
 * GPU metrics interface - all providers must implement this
 */
export interface GPUMetrics {
  // Required metrics (all tiers must provide)
  vramTotal: number; // Total VRAM in GB
  vramUsed: number; // Used VRAM in GB
  vramFree: number; // Free VRAM in GB
  computeCapability: string; // e.g., "sm_120" for RTX 5090
  deviceName: string; // e.g., "NVIDIA GeForce RTX 5090"

  // Optional metrics (Tier 1/2 only, undefined in Tier 3 simulated)
  temperature?: number; // GPU temperature in Celsius
  powerDraw?: number; // Power consumption in Watts
  clockSpeed?: number; // GPU clock speed in MHz
  eccEnabled?: boolean; // ECC memory status
  pciThroughput?: number; // PCIe throughput in GB/s
  utilizationGPU?: number; // GPU utilization percentage (0-100)
  utilizationMemory?: number; // Memory utilization percentage (0-100)
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  healthy: boolean;
  reason?: string;
  warnings?: string[];
}

/**
 * GPU provider interface - implemented by NVML, nvidia-smi, and simulated providers
 */
export interface GPUProvider {
  /** Human-readable name for logging */
  readonly name: string;

  /** Provider tier (1=NVML, 2=nvidia-smi, 3=simulated) */
  readonly tier: 1 | 2 | 3;

  /**
   * Detection: Can this provider run in current environment?
   * Returns true if provider can function, false otherwise
   */
  isAvailable(): Promise<boolean>;

  /**
   * Fetch current GPU metrics
   * @throws Error if GPU cannot be accessed
   */
  getMetrics(): Promise<GPUMetrics>;

  /**
   * Health check for monitoring
   * Non-throwing version of getMetrics for status monitoring
   */
  healthCheck(): Promise<HealthCheckResult>;

  /**
   * Cleanup resources (e.g., NVML shutdown)
   * Optional - only needed for providers that hold resources
   */
  cleanup?(): Promise<void>;
}

/**
 * Base class for GPU providers with common functionality
 */
export abstract class BaseGPUProvider implements GPUProvider {
  abstract readonly name: string;
  abstract readonly tier: 1 | 2 | 3;

  abstract isAvailable(): Promise<boolean>;
  abstract getMetrics(): Promise<GPUMetrics>;

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      await this.getMetrics();
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        reason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Validate metrics for consistency
   * @throws Error if metrics are invalid
   */
  protected validateMetrics(metrics: GPUMetrics): void {
    if (metrics.vramTotal <= 0) {
      throw new Error('Invalid vramTotal: must be > 0');
    }
    if (metrics.vramUsed < 0 || metrics.vramUsed > metrics.vramTotal) {
      throw new Error(`Invalid vramUsed: ${metrics.vramUsed} (total: ${metrics.vramTotal})`);
    }
    if (metrics.vramFree < 0 || metrics.vramFree > metrics.vramTotal) {
      throw new Error(`Invalid vramFree: ${metrics.vramFree} (total: ${metrics.vramTotal})`);
    }
    // Allow small floating-point errors
    const sumVRAM = metrics.vramUsed + metrics.vramFree;
    if (Math.abs(sumVRAM - metrics.vramTotal) > 0.1) {
      throw new Error(
        `VRAM accounting mismatch: used(${metrics.vramUsed}) + free(${metrics.vramFree}) != total(${metrics.vramTotal})`
      );
    }
  }

  /**
   * Parse compute capability string to standardized format
   * Examples: "9.0" → "sm_90", "sm_120" → "sm_120"
   */
  protected parseComputeCapability(raw: string): string {
    // If already in sm_XX format, return as-is
    if (raw.startsWith('sm_')) {
      return raw;
    }
    // Convert "9.0" → "sm_90"
    const cleaned = raw.replace('.', '');
    return `sm_${cleaned}`;
  }
}
