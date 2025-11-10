/**
 * Unit tests for NVMLProvider (Tier 1)
 *
 * Tests mock the node-nvidia-smi module to simulate NVML output
 */

// Create a virtual mock for the optional dependency
const mockNvidiaSmi = jest.fn();
jest.mock('node-nvidia-smi', () => mockNvidiaSmi, { virtual: true });

import { NVMLProvider } from '../../src/providers/nvml-provider';

describe('NVMLProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic functionality', () => {
    it('should have correct tier and name', () => {
      const provider = new NVMLProvider();
      expect(provider.tier).toBe(1);
      expect(provider.name).toBe('NVML');
    });

    it('should use default configuration', () => {
      const provider = new NVMLProvider();
      expect(provider).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const provider = new NVMLProvider({ deviceIndex: 1 });
      expect(provider).toBeDefined();
    });
  });

  describe('isAvailable', () => {
    it('should return true when NVML is available', async () => {
      mockNvidiaSmi.mockResolvedValue({
        nvidia_smi_log: {
          driver_version: '535.129.03',
          gpu: [{ product_name: 'NVIDIA GeForce RTX 5090' }],
        },
      });

      const provider = new NVMLProvider();
      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });

    it('should return false when no GPUs found', async () => {
      mockNvidiaSmi.mockResolvedValue({
        nvidia_smi_log: {
          driver_version: '535.129.03',
          gpu: [],
        },
      });

      const provider = new NVMLProvider();
      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });
  });

  describe('getMetrics', () => {
    it('should parse RTX 5090 metrics correctly', async () => {
      const mockData = {
        nvidia_smi_log: {
          driver_version: '535.129.03',
          gpu: [
            {
              product_name: 'NVIDIA GeForce RTX 5090',
              fb_memory_usage: {
                total: '32768 MiB',
                used: '8192 MiB',
                free: '24576 MiB',
              },
              utilization: {
                gpu_util: '25 %',
                memory_util: '25 %',
              },
              temperature: {
                gpu_temp: '65 C',
              },
              power_readings: {
                power_draw: '350.5 W',
              },
              clocks: {
                graphics_clock: '2600 MHz',
              },
              pci: {
                pci_bus: '0000:01:00.0',
                link_widths: {
                  current_link_width: 'x16',
                },
              },
              ecc_mode: {
                current_ecc: 'Enabled',
              },
            },
          ],
        },
      };

      mockNvidiaSmi.mockResolvedValue(mockData);

      const provider = new NVMLProvider();
      await provider.isAvailable(); // Initialize
      const metrics = await provider.getMetrics();

      expect(metrics.deviceName).toBe('NVIDIA GeForce RTX 5090');
      expect(metrics.vramTotal).toBeCloseTo(32, 1);
      expect(metrics.vramUsed).toBeCloseTo(8, 1);
      expect(metrics.vramFree).toBeCloseTo(24, 1);
      expect(metrics.computeCapability).toBe('sm_120');
      expect(metrics.temperature).toBe(65);
      expect(metrics.powerDraw).toBeCloseTo(350.5, 1);
      expect(metrics.clockSpeed).toBe(2600);
      expect(metrics.eccEnabled).toBe(true);
      expect(metrics.utilizationGPU).toBe(25);
      expect(metrics.utilizationMemory).toBe(25);
      expect(metrics.pciThroughput).toBeCloseTo(32, 1);
    });

    it('should handle missing optional metrics', async () => {
      const mockData = {
        nvidia_smi_log: {
          gpu: [
            {
              product_name: 'NVIDIA GPU',
              fb_memory_usage: {
                total: '16384 MiB',
                used: '4096 MiB',
                free: '12288 MiB',
              },
              // Missing utilization, temperature, power, etc.
            },
          ],
        },
      };

      mockNvidiaSmi.mockResolvedValue(mockData);

      const provider = new NVMLProvider();
      await provider.isAvailable();
      const metrics = await provider.getMetrics();

      expect(metrics.deviceName).toBe('NVIDIA GPU');
      expect(metrics.vramTotal).toBeCloseTo(16, 1);
      expect(metrics.temperature).toBeUndefined();
      expect(metrics.powerDraw).toBeUndefined();
      expect(metrics.utilizationGPU).toBeUndefined();
    });

    it('should handle ECC disabled', async () => {
      const mockData = {
        nvidia_smi_log: {
          gpu: [
            {
              product_name: 'GeForce GTX 1080',
              fb_memory_usage: {
                total: '8192 MiB',
                used: '2048 MiB',
                free: '6144 MiB',
              },
              ecc_mode: {
                current_ecc: 'Disabled',
              },
            },
          ],
        },
      };

      mockNvidiaSmi.mockResolvedValue(mockData);

      const provider = new NVMLProvider();
      await provider.isAvailable();
      const metrics = await provider.getMetrics();

      expect(metrics.eccEnabled).toBe(false);
    });

    it('should throw when GPU not found at index', async () => {
      const mockData = {
        nvidia_smi_log: {
          gpu: [{ product_name: 'GPU 0' }],
        },
      };

      mockNvidiaSmi.mockResolvedValue(mockData);

      const provider = new NVMLProvider({ deviceIndex: 1 });
      await provider.isAvailable();
      await expect(provider.getMetrics()).rejects.toThrow('GPU at index 1 not found');
    });

    it('should throw when NVML not initialized', async () => {
      const provider = new NVMLProvider();
      // Don't call isAvailable()
      await expect(provider.getMetrics()).rejects.toThrow('NVML not initialized');
    });
  });

  describe('Compute capability derivation', () => {
    const testCases = [
      { gpu: 'NVIDIA GeForce RTX 5090', expected: 'sm_120' },
      { gpu: 'NVIDIA GeForce RTX 4090', expected: 'sm_89' },
      { gpu: 'NVIDIA GeForce RTX 3090', expected: 'sm_86' },
      { gpu: 'NVIDIA A100-SXM4-40GB', expected: 'sm_86' },
      { gpu: 'NVIDIA GeForce RTX 2080 Ti', expected: 'sm_75' },
      { gpu: 'NVIDIA GeForce GTX 1080 Ti', expected: 'sm_61' },
      { gpu: 'Unknown GPU', expected: 'sm_unknown' },
    ];

    testCases.forEach(({ gpu, expected }) => {
      it(`should derive ${expected} for ${gpu}`, async () => {
        const mockData = {
          nvidia_smi_log: {
            gpu: [
              {
                product_name: gpu,
                fb_memory_usage: {
                  total: '8192 MiB',
                  used: '2048 MiB',
                  free: '6144 MiB',
                },
              },
            ],
          },
        };

        mockNvidiaSmi.mockResolvedValue(mockData);

        const provider = new NVMLProvider();
        await provider.isAvailable();
        const metrics = await provider.getMetrics();

        expect(metrics.computeCapability).toBe(expected);
      });
    });
  });

  describe('PCIe throughput calculation', () => {
    it('should calculate x16 link throughput', async () => {
      const mockData = {
        nvidia_smi_log: {
          gpu: [
            {
              product_name: 'GPU',
              fb_memory_usage: {
                total: '8192 MiB',
                used: '2048 MiB',
                free: '6144 MiB',
              },
              pci: {
                link_widths: {
                  current_link_width: 'x16',
                },
              },
            },
          ],
        },
      };

      mockNvidiaSmi.mockResolvedValue(mockData);

      const provider = new NVMLProvider();
      await provider.isAvailable();
      const metrics = await provider.getMetrics();

      expect(metrics.pciThroughput).toBeCloseTo(32, 1);
    });

    it('should calculate x8 link throughput', async () => {
      const mockData = {
        nvidia_smi_log: {
          gpu: [
            {
              product_name: 'GPU',
              fb_memory_usage: {
                total: '8192 MiB',
                used: '2048 MiB',
                free: '6144 MiB',
              },
              pci: {
                link_widths: {
                  current_link_width: 'x8',
                },
              },
            },
          ],
        },
      };

      mockNvidiaSmi.mockResolvedValue(mockData);

      const provider = new NVMLProvider();
      await provider.isAvailable();
      const metrics = await provider.getMetrics();

      expect(metrics.pciThroughput).toBeCloseTo(16, 1);
    });

    it('should handle missing PCIe info', async () => {
      const mockData = {
        nvidia_smi_log: {
          gpu: [
            {
              product_name: 'GPU',
              fb_memory_usage: {
                total: '8192 MiB',
                used: '2048 MiB',
                free: '6144 MiB',
              },
            },
          ],
        },
      };

      mockNvidiaSmi.mockResolvedValue(mockData);

      const provider = new NVMLProvider();
      await provider.isAvailable();
      const metrics = await provider.getMetrics();

      expect(metrics.pciThroughput).toBeUndefined();
    });
  });

  describe('Metrics validation', () => {
    it('should validate VRAM consistency', async () => {
      const mockData = {
        nvidia_smi_log: {
          gpu: [
            {
              product_name: 'GPU',
              fb_memory_usage: {
                total: '32768 MiB',
                used: '16384 MiB',
                free: '16384 MiB',
              },
            },
          ],
        },
      };

      mockNvidiaSmi.mockResolvedValue(mockData);

      const provider = new NVMLProvider();
      await provider.isAvailable();
      const metrics = await provider.getMetrics();

      expect(metrics.vramUsed + metrics.vramFree).toBeCloseTo(metrics.vramTotal, 1);
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      mockNvidiaSmi.mockResolvedValue({
        nvidia_smi_log: {
          gpu: [{ product_name: 'GPU' }],
        },
      });

      const provider = new NVMLProvider();
      await provider.isAvailable();
      await provider.cleanup();

      // Should be able to cleanup multiple times
      await provider.cleanup();
    });
  });
});
