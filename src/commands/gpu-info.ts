import { Command } from 'commander';

interface GPUInfoOptions {
  json?: boolean;
  watch?: boolean;
}

export async function gpuInfoCommand(options: GPUInfoOptions): Promise<void> {
  // TODO: Implement GPU detection and display
  // This will use the GPUDetector from core/gpu-detector.ts
  console.log('GPU Info command - to be implemented');
  console.log('Options:', options);
}
