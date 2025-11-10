import { createGPUDetector } from '../utils/gpu-factory';
import { GPUMetrics } from '../core/gpu-provider';

interface GPUInfoOptions {
  json?: boolean;
  watch?: boolean;
  interval?: number;
}

export async function gpuInfoCommand(options: GPUInfoOptions): Promise<void> {
  try {
    const detector = await createGPUDetector();

    if (options.watch) {
      // Watch mode: continuously display metrics
      const interval = (options.interval ?? 1) * 1000; // Convert to ms
      console.log(`Watching GPU metrics (refresh every ${options.interval ?? 1}s). Press Ctrl+C to exit.\n`);

      const displayMetrics = async (): Promise<void> => {
        const metrics = await detector.getMetrics();
        const health = await detector.healthCheck();

        if (options.json) {
          console.log(JSON.stringify({ metrics, health, provider: detector.getProviderName() }, null, 2));
        } else {
          console.clear();
          displayFormattedMetrics(metrics, detector.getProviderName(), health.warnings);
        }
      };

      // Display once immediately
      await displayMetrics();

      // Then set up interval
      const intervalId = setInterval(() => {
        void displayMetrics();
      }, interval);

      // Handle cleanup
      process.on('SIGINT', () => {
        clearInterval(intervalId);
        void detector.cleanup();
        process.exit(0);
      });
    } else {
      // Single display
      const metrics = await detector.getMetrics();
      const health = await detector.healthCheck();

      if (options.json) {
        console.log(JSON.stringify({ metrics, health, provider: detector.getProviderName() }, null, 2));
      } else {
        displayFormattedMetrics(metrics, detector.getProviderName(), health.warnings);
      }

      await detector.cleanup();
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('Unknown error occurred');
    }
    process.exit(1);
  }
}

/**
 * Display GPU metrics in a human-readable format
 */
function displayFormattedMetrics(metrics: GPUMetrics, providerName: string, warnings?: string[]): void {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  GPU Information (via ${providerName})`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();

  console.log(`Device:              ${metrics.deviceName}`);
  console.log(`Compute Capability:  ${metrics.computeCapability}`);
  console.log();

  console.log('Memory:');
  console.log(`  Total:             ${metrics.vramTotal.toFixed(2)} GB`);
  console.log(`  Used:              ${metrics.vramUsed.toFixed(2)} GB`);
  console.log(`  Free:              ${metrics.vramFree.toFixed(2)} GB`);
  if (metrics.utilizationMemory !== undefined) {
    console.log(`  Utilization:       ${metrics.utilizationMemory}%`);
  }
  console.log();

  if (metrics.utilizationGPU !== undefined) {
    console.log(`GPU Utilization:     ${metrics.utilizationGPU}%`);
  }

  if (metrics.temperature !== undefined) {
    const tempColor = metrics.temperature > 80 ? '🔴' : metrics.temperature > 70 ? '🟡' : '🟢';
    console.log(`Temperature:         ${tempColor} ${metrics.temperature}°C`);
  }

  if (metrics.powerDraw !== undefined) {
    console.log(`Power Draw:          ${metrics.powerDraw.toFixed(1)} W`);
  }

  if (metrics.clockSpeed !== undefined) {
    console.log(`Clock Speed:         ${metrics.clockSpeed} MHz`);
  }

  if (metrics.eccEnabled !== undefined) {
    console.log(`ECC Memory:          ${metrics.eccEnabled ? 'Enabled ✓' : 'Disabled'}`);
  }

  if (metrics.pciThroughput !== undefined) {
    console.log(`PCIe Throughput:     ~${metrics.pciThroughput.toFixed(1)} GB/s`);
  }

  if (warnings && warnings.length > 0) {
    console.log();
    console.log('⚠️  Warnings:');
    warnings.forEach((warning) => {
      console.log(`  - ${warning}`);
    });
  }

  console.log();
  console.log('═══════════════════════════════════════════════════════════════');
}
