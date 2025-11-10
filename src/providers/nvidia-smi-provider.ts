/**
 * Nvidia-SMI GPU Provider (Tier 2) - ADR-003
 *
 * Uses nvidia-smi CLI to query GPU metrics when NVML bindings are unavailable.
 * Falls back to this when NVML provider cannot load.
 *
 * Executes nvidia-smi with --query-gpu flag and parses CSV output.
 */

import { BaseGPUProvider, GPUMetrics } from '../core/gpu-provider';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Configuration for nvidia-smi execution
 */
export interface NvidiaSMIConfig {
  /** nvidia-smi binary path (default: 'nvidia-smi') */
  binaryPath?: string;
  /** Timeout for nvidia-smi execution in ms (default: 5000) */
  timeout?: number;
  /** GPU device index to query (default: 0) */
  deviceIndex?: number;
}

export class NvidiaSMIProvider extends BaseGPUProvider {
  readonly name = 'nvidia-smi';
  readonly tier = 2 as const;

  private config: Required<NvidiaSMIConfig>;

  constructor(config: NvidiaSMIConfig = {}) {
    super();

    this.config = {
      binaryPath: config.binaryPath ?? 'nvidia-smi',
      timeout: config.timeout ?? 5000,
      deviceIndex: config.deviceIndex ?? 0,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const { stdout, stderr } = await execAsync(`${this.config.binaryPath} --version`, {
        timeout: this.config.timeout,
      });

      // Check for successful execution and NVIDIA in output
      return !stderr && stdout.toLowerCase().includes('nvidia');
    } catch (error) {
      // nvidia-smi not found or failed to execute
      return false;
    }
  }

  async getMetrics(): Promise<GPUMetrics> {
    // Query specific GPU metrics using CSV format for easier parsing
    const query = [
      'name',
      'memory.total',
      'memory.used',
      'memory.free',
      'compute_cap',
      'temperature.gpu',
      'power.draw',
      'clocks.gr',
      'ecc.mode.current',
      'pcie.link.width.current',
      'utilization.gpu',
      'utilization.memory',
    ].join(',');

    const command = `${this.config.binaryPath} --query-gpu=${query} --format=csv,noheader,nounits -i ${this.config.deviceIndex}`;

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: this.config.timeout,
      });

      if (stderr) {
        throw new Error(`nvidia-smi stderr: ${stderr}`);
      }

      const metrics = this.parseCSVOutput(stdout);
      this.validateMetrics(metrics);

      return metrics;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get GPU metrics: ${error.message}`);
      }
      throw new Error('Failed to get GPU metrics: unknown error');
    }
  }

  /**
   * Parse CSV output from nvidia-smi
   * Expected format: name,memory.total,memory.used,memory.free,compute_cap,temp,power,clock,ecc,pcie,util_gpu,util_mem
   */
  private parseCSVOutput(output: string): GPUMetrics {
    const line = output.trim();
    if (!line) {
      throw new Error('Empty output from nvidia-smi');
    }

    const parts = line.split(',').map((s) => s.trim());

    if (parts.length < 12) {
      throw new Error(`Invalid nvidia-smi output format: expected 12 fields, got ${parts.length}`);
    }

    // Extract values with explicit assertions after validation
    const name = parts[0]!;
    const memTotalStr = parts[1]!;
    const memUsedStr = parts[2]!;
    const memFreeStr = parts[3]!;
    const computeCapStr = parts[4]!;
    const tempStr = parts[5]!;
    const powerStr = parts[6]!;
    const clockStr = parts[7]!;
    const eccStr = parts[8]!;
    const pcieStr = parts[9]!;
    const utilGpuStr = parts[10]!;
    const utilMemStr = parts[11]!;

    // Parse numeric values (nvidia-smi outputs in MiB for memory)
    const vramTotal = parseFloat(memTotalStr) / 1024; // Convert MiB to GiB
    const vramUsed = parseFloat(memUsedStr) / 1024;
    const vramFree = parseFloat(memFreeStr) / 1024;

    // Handle N/A values which nvidia-smi returns for unavailable metrics
    const temperature = this.parseOptionalFloat(tempStr);
    const powerDraw = this.parseOptionalFloat(powerStr);
    const clockSpeed = this.parseOptionalFloat(clockStr);
    const utilizationGPU = this.parseOptionalFloat(utilGpuStr);
    const utilizationMemory = this.parseOptionalFloat(utilMemStr);

    // ECC enabled status (Enabled/Disabled)
    const eccEnabled = eccStr.toLowerCase() === 'enabled' ? true : eccStr.toLowerCase() === 'disabled' ? false : undefined;

    // PCIe throughput approximation (not directly available, use link width)
    const pcieWidth = this.parseOptionalFloat(pcieStr);
    // PCIe Gen4 x16 = ~32 GB/s per direction, scale by width
    const pciThroughput = pcieWidth ? (pcieWidth / 16) * 32 : undefined;

    return {
      vramTotal,
      vramUsed,
      vramFree,
      computeCapability: this.parseComputeCapability(computeCapStr),
      deviceName: name,
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
   * Parse optional float value, returning undefined for "N/A" or invalid values
   */
  private parseOptionalFloat(value: string): number | undefined {
    if (!value || value === 'N/A' || value === '[N/A]' || value === '[Not Supported]') {
      return undefined;
    }

    const parsed = parseFloat(value);
    return isNaN(parsed) ? undefined : parsed;
  }
}
