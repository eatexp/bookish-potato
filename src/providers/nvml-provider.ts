/**
 * NVML GPU Provider (Tier 1) - ADR-003
 *
 * Uses NVIDIA Management Library (NVML) native bindings for highest performance
 * and most accurate metrics. This is the preferred provider when available.
 *
 * Requires node-nvidia-smi package (optional dependency).
 */

import { BaseGPUProvider, GPUMetrics } from '../core/gpu-provider';

/**
 * Configuration for NVML provider
 */
export interface NVMLConfig {
  /** GPU device index to query (default: 0) */
  deviceIndex?: number;
}

/**
 * Type definitions for node-nvidia-smi package
 * These are minimal types since the package doesn't provide its own
 */
interface NvidiaSMI {
  (): Promise<{
    nvidia_smi_log?: {
      driver_version?: string;
      cuda_version?: string;
      gpu?: Array<{
        product_name?: string;
        fb_memory_usage?: {
          total?: string;
          used?: string;
          free?: string;
        };
        utilization?: {
          gpu_util?: string;
          memory_util?: string;
        };
        temperature?: {
          gpu_temp?: string;
        };
        power_readings?: {
          power_draw?: string;
        };
        clocks?: {
          graphics_clock?: string;
        };
        max_clocks?: {
          graphics_clock?: string;
        };
        pci?: {
          pci_bus?: string;
          link_widths?: {
            current_link_width?: string;
          };
        };
        ecc_mode?: {
          current_ecc?: string;
        };
        cuda_version?: string;
      }>;
    };
  }>;
}

export class NVMLProvider extends BaseGPUProvider {
  readonly name = 'NVML';
  readonly tier = 1 as const;

  private config: Required<NVMLConfig>;
  private nvidiaSmi?: NvidiaSMI;

  constructor(config: NVMLConfig = {}) {
    super();

    this.config = {
      deviceIndex: config.deviceIndex ?? 0,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Try to dynamically import the optional dependency
      // @ts-ignore - optional dependency may not be installed
      const module = await import('node-nvidia-smi');
      this.nvidiaSmi = module.default as NvidiaSMI;

      // Test if we can actually query
      const result = await this.nvidiaSmi();
      return !!result?.nvidia_smi_log?.gpu && result.nvidia_smi_log.gpu.length > 0;
    } catch (error) {
      // Module not installed or NVML not available
      return false;
    }
  }

  async getMetrics(): Promise<GPUMetrics> {
    if (!this.nvidiaSmi) {
      throw new Error('NVML not initialized. Call isAvailable() first.');
    }

    try {
      const result = await this.nvidiaSmi();
      const gpu = result?.nvidia_smi_log?.gpu?.[this.config.deviceIndex];

      if (!gpu) {
        throw new Error(`GPU at index ${this.config.deviceIndex} not found`);
      }

      const metrics = this.parseNVMLOutput(gpu);
      this.validateMetrics(metrics);

      return metrics;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get NVML metrics: ${error.message}`);
      }
      throw new Error('Failed to get NVML metrics: unknown error');
    }
  }

  /**
   * Parse NVML output from node-nvidia-smi
   */
  private parseNVMLOutput(gpu: NonNullable<NonNullable<NonNullable<Awaited<ReturnType<NvidiaSMI>>['nvidia_smi_log']>['gpu']>[0]>): GPUMetrics {
    // Parse memory (comes in "X MiB" format)
    const vramTotal = this.parseMemoryString(gpu.fb_memory_usage?.total);
    const vramUsed = this.parseMemoryString(gpu.fb_memory_usage?.used);
    const vramFree = this.parseMemoryString(gpu.fb_memory_usage?.free);

    // Parse utilization (comes in "X %" format)
    const utilizationGPU = this.parsePercentageString(gpu.utilization?.gpu_util);
    const utilizationMemory = this.parsePercentageString(gpu.utilization?.memory_util);

    // Parse temperature (comes in "X C" format)
    const temperature = this.parseNumericString(gpu.temperature?.gpu_temp, 'C');

    // Parse power (comes in "X.XX W" format)
    const powerDraw = this.parseNumericString(gpu.power_readings?.power_draw, 'W');

    // Parse clock speed (comes in "X MHz" format)
    const clockSpeed = this.parseNumericString(gpu.clocks?.graphics_clock, 'MHz');

    // Parse ECC mode
    const eccEnabled = gpu.ecc_mode?.current_ecc?.toLowerCase() === 'enabled' ? true : gpu.ecc_mode?.current_ecc?.toLowerCase() === 'disabled' ? false : undefined;

    // Parse PCIe link width (comes as "xX" format, e.g., "x16")
    const pcieWidth = this.parsePCIeWidth(gpu.pci?.link_widths?.current_link_width);
    const pciThroughput = pcieWidth ? (pcieWidth / 16) * 32 : undefined;

    // Derive compute capability from product name (approximation for common GPUs)
    const productName = gpu.product_name || 'Unknown GPU';
    const computeCapability = this.deriveComputeCapability(productName);

    return {
      vramTotal,
      vramUsed,
      vramFree,
      computeCapability,
      deviceName: productName,
      temperature,
      powerDraw,
      clockSpeed,
      eccEnabled,
      pciThroughput,
      utilizationGPU,
      utilizationMemory,
    };
  }

  /**
   * Parse memory string like "32768 MiB" to GB
   */
  private parseMemoryString(value: string | undefined): number {
    if (!value) {
      throw new Error('Missing required memory value');
    }

    const match = value.match(/^(\d+(?:\.\d+)?)\s*MiB$/i);
    if (!match || !match[1]) {
      throw new Error(`Invalid memory format: ${value}`);
    }

    return parseFloat(match[1]) / 1024; // Convert MiB to GiB
  }

  /**
   * Parse percentage string like "25 %" to number
   */
  private parsePercentageString(value: string | undefined): number | undefined {
    if (!value) {
      return undefined;
    }

    const match = value.match(/^(\d+(?:\.\d+)?)\s*%$/);
    if (!match || !match[1]) {
      return undefined;
    }

    return parseFloat(match[1]);
  }

  /**
   * Parse numeric string with unit like "65 C" or "350.5 W"
   */
  private parseNumericString(value: string | undefined, unit: string): number | undefined {
    if (!value) {
      return undefined;
    }

    const regex = new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*${unit}$`, 'i');
    const match = value.match(regex);
    if (!match || !match[1]) {
      return undefined;
    }

    return parseFloat(match[1]);
  }

  /**
   * Parse PCIe width like "x16" to number
   */
  private parsePCIeWidth(value: string | undefined): number | undefined {
    if (!value) {
      return undefined;
    }

    const match = value.match(/^x(\d+)$/i);
    if (!match || !match[1]) {
      return undefined;
    }

    return parseInt(match[1], 10);
  }

  /**
   * Derive compute capability from GPU product name
   * This is an approximation - ideally NVML would provide this directly
   */
  private deriveComputeCapability(productName: string): string {
    const name = productName.toLowerCase();

    // RTX 50 series (Blackwell) - compute capability 12.0
    if (name.includes('rtx 50') || name.includes('rtx50')) {
      return 'sm_120';
    }

    // RTX 40 series (Ada Lovelace) - compute capability 8.9
    if (name.includes('rtx 40') || name.includes('rtx40') || name.includes('ada')) {
      return 'sm_89';
    }

    // RTX 30 series (Ampere) - compute capability 8.6
    if (name.includes('rtx 30') || name.includes('rtx30') || name.includes('ampere') || name.includes('a100') || name.includes('a40')) {
      return 'sm_86';
    }

    // RTX 20 series & GTX 16 series (Turing) - compute capability 7.5
    if (name.includes('rtx 20') || name.includes('rtx20') || name.includes('gtx 16') || name.includes('turing')) {
      return 'sm_75';
    }

    // GTX 10 series (Pascal) - compute capability 6.1
    if (name.includes('gtx 10') || name.includes('gtx10') || name.includes('pascal') || name.includes('titan x')) {
      return 'sm_61';
    }

    // Default fallback
    return 'sm_unknown';
  }

  async cleanup(): Promise<void> {
    // NVML bindings are automatically cleaned up by the module
    this.nvidiaSmi = undefined;
  }
}
