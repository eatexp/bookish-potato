/**
 * Unit tests for NvidiaSMIProvider (Tier 2)
 *
 * Tests use mocked child_process.exec to simulate nvidia-smi command output
 */

import { NvidiaSMIProvider } from '../../src/providers/nvidia-smi-provider';
import { exec } from 'child_process';
import { promisify } from 'util';

// Mock child_process module
jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

const execAsync = promisify(exec);
const mockExec = exec as unknown as jest.Mock;

describe('NvidiaSMIProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic functionality', () => {
    it('should have correct tier and name', () => {
      const provider = new NvidiaSMIProvider();
      expect(provider.tier).toBe(2);
      expect(provider.name).toBe('nvidia-smi');
    });

    it('should use default configuration', () => {
      const provider = new NvidiaSMIProvider();
      expect(provider).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const provider = new NvidiaSMIProvider({
        binaryPath: '/custom/path/nvidia-smi',
        timeout: 10000,
        deviceIndex: 1,
      });
      expect(provider).toBeDefined();
    });
  });

  describe('isAvailable', () => {
    it('should return true when nvidia-smi is available', async () => {
      mockExec.mockImplementation((_cmd, _opts, callback) => {
        if (callback) {
          callback(null, { stdout: 'NVIDIA-SMI 535.129.03\nDriver Version: 535.129.03\n', stderr: '' });
        }
      });

      const provider = new NvidiaSMIProvider();
      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });

    it('should return false when nvidia-smi is not found', async () => {
      mockExec.mockImplementation((_cmd, _opts, callback) => {
        if (callback) {
          callback(new Error('Command not found'), { stdout: '', stderr: '' });
        }
      });

      const provider = new NvidiaSMIProvider();
      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });

    it('should return false on execution error', async () => {
      mockExec.mockImplementation((_cmd, _opts, callback) => {
        if (callback) {
          callback(new Error('Permission denied'), { stdout: '', stderr: '' });
        }
      });

      const provider = new NvidiaSMIProvider();
      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });
  });

  describe('getMetrics', () => {
    it('should parse RTX 5090 metrics correctly', async () => {
      const mockOutput =
        'NVIDIA GeForce RTX 5090, 32768, 8192, 24576, 12.0, 65, 350.5, 2600, Enabled, 16, 25, 25\n';

      mockExec.mockImplementation((cmd, _opts, callback) => {
        if (callback && cmd.includes('--query-gpu')) {
          callback(null, { stdout: mockOutput, stderr: '' });
        }
      });

      const provider = new NvidiaSMIProvider();
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
    });

    it('should handle N/A values for optional metrics', async () => {
      const mockOutput = 'NVIDIA GPU, 16384, 4096, 12288, 8.9, N/A, N/A, 1500, Disabled, N/A, N/A, N/A\n';

      mockExec.mockImplementation((cmd, _opts, callback) => {
        if (callback && cmd.includes('--query-gpu')) {
          callback(null, { stdout: mockOutput, stderr: '' });
        }
      });

      const provider = new NvidiaSMIProvider();
      const metrics = await provider.getMetrics();

      expect(metrics.deviceName).toBe('NVIDIA GPU');
      expect(metrics.vramTotal).toBeCloseTo(16, 1);
      expect(metrics.computeCapability).toBe('sm_89');
      expect(metrics.temperature).toBeUndefined();
      expect(metrics.powerDraw).toBeUndefined();
      expect(metrics.eccEnabled).toBe(false);
      expect(metrics.utilizationGPU).toBeUndefined();
    });

    it('should handle [Not Supported] values', async () => {
      const mockOutput =
        'GeForce GTX 1080, 8192, 2048, 6144, 6.1, 72, [Not Supported], 1733, [Not Supported], 16, 45, 30\n';

      mockExec.mockImplementation((cmd, _opts, callback) => {
        if (callback && cmd.includes('--query-gpu')) {
          callback(null, { stdout: mockOutput, stderr: '' });
        }
      });

      const provider = new NvidiaSMIProvider();
      const metrics = await provider.getMetrics();

      expect(metrics.deviceName).toBe('GeForce GTX 1080');
      expect(metrics.vramTotal).toBeCloseTo(8, 1);
      expect(metrics.computeCapability).toBe('sm_61');
      expect(metrics.powerDraw).toBeUndefined();
      expect(metrics.eccEnabled).toBeUndefined();
    });

    it('should throw on empty output', async () => {
      mockExec.mockImplementation((cmd, _opts, callback) => {
        if (callback && cmd.includes('--query-gpu')) {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      const provider = new NvidiaSMIProvider();
      await expect(provider.getMetrics()).rejects.toThrow('Empty output');
    });

    it('should throw on invalid CSV format', async () => {
      mockExec.mockImplementation((cmd, _opts, callback) => {
        if (callback && cmd.includes('--query-gpu')) {
          callback(null, { stdout: 'invalid,csv', stderr: '' });
        }
      });

      const provider = new NvidiaSMIProvider();
      await expect(provider.getMetrics()).rejects.toThrow('Invalid nvidia-smi output format');
    });

    it('should throw when nvidia-smi reports error', async () => {
      mockExec.mockImplementation((cmd, _opts, callback) => {
        if (callback && cmd.includes('--query-gpu')) {
          callback(null, { stdout: '', stderr: 'No devices were found' });
        }
      });

      const provider = new NvidiaSMIProvider();
      await expect(provider.getMetrics()).rejects.toThrow('nvidia-smi stderr');
    });

    it('should throw on command execution failure', async () => {
      mockExec.mockImplementation((cmd, _opts, callback) => {
        if (callback && cmd.includes('--query-gpu')) {
          callback(new Error('Command failed'), { stdout: '', stderr: '' });
        }
      });

      const provider = new NvidiaSMIProvider();
      await expect(provider.getMetrics()).rejects.toThrow('Failed to get GPU metrics');
    });
  });

  describe('Metrics validation', () => {
    it('should validate VRAM consistency', async () => {
      const mockOutput =
        'NVIDIA GeForce RTX 5090, 32768, 16384, 16384, 12.0, 70, 400, 2700, Enabled, 16, 50, 50\n';

      mockExec.mockImplementation((cmd, _opts, callback) => {
        if (callback && cmd.includes('--query-gpu')) {
          callback(null, { stdout: mockOutput, stderr: '' });
        }
      });

      const provider = new NvidiaSMIProvider();
      const metrics = await provider.getMetrics();

      // Should not throw
      expect(metrics.vramUsed + metrics.vramFree).toBeCloseTo(metrics.vramTotal, 1);
    });
  });

  describe('Custom device index', () => {
    it('should query specific GPU device', async () => {
      const mockOutput = 'GPU 1, 24576, 8192, 16384, 9.0, 68, 320, 2400, Enabled, 16, 30, 33\n';

      mockExec.mockImplementation((cmd, _opts, callback) => {
        if (callback && cmd.includes('--query-gpu') && cmd.includes('-i 1')) {
          callback(null, { stdout: mockOutput, stderr: '' });
        }
      });

      const provider = new NvidiaSMIProvider({ deviceIndex: 1 });
      const metrics = await provider.getMetrics();

      expect(metrics.deviceName).toBe('GPU 1');
      expect(metrics.vramTotal).toBeCloseTo(24, 1);
    });
  });

  describe('Compute capability parsing', () => {
    it('should convert dot notation to sm_ format', async () => {
      const testCases = [
        { input: '12.0', expected: 'sm_120' },
        { input: '8.9', expected: 'sm_89' },
        { input: '7.5', expected: 'sm_75' },
        { input: '6.1', expected: 'sm_61' },
      ];

      for (const testCase of testCases) {
        const mockOutput = `GPU, 8192, 2048, 6144, ${testCase.input}, N/A, N/A, 1500, N/A, N/A, N/A, N/A\n`;

        mockExec.mockImplementation((cmd, _opts, callback) => {
          if (callback && cmd.includes('--query-gpu')) {
            callback(null, { stdout: mockOutput, stderr: '' });
          }
        });

        const provider = new NvidiaSMIProvider();
        const metrics = await provider.getMetrics();

        expect(metrics.computeCapability).toBe(testCase.expected);
      }
    });
  });

  describe('PCIe throughput calculation', () => {
    it('should calculate PCIe throughput from link width', async () => {
      const mockOutput = 'GPU, 8192, 2048, 6144, 8.0, N/A, N/A, 1500, N/A, 16, N/A, N/A\n';

      mockExec.mockImplementation((cmd, _opts, callback) => {
        if (callback && cmd.includes('--query-gpu')) {
          callback(null, { stdout: mockOutput, stderr: '' });
        }
      });

      const provider = new NvidiaSMIProvider();
      const metrics = await provider.getMetrics();

      // x16 link should give ~32 GB/s throughput
      expect(metrics.pciThroughput).toBeCloseTo(32, 1);
    });

    it('should handle x8 PCIe width', async () => {
      const mockOutput = 'GPU, 8192, 2048, 6144, 8.0, N/A, N/A, 1500, N/A, 8, N/A, N/A\n';

      mockExec.mockImplementation((cmd, _opts, callback) => {
        if (callback && cmd.includes('--query-gpu')) {
          callback(null, { stdout: mockOutput, stderr: '' });
        }
      });

      const provider = new NvidiaSMIProvider();
      const metrics = await provider.getMetrics();

      // x8 link should give ~16 GB/s throughput
      expect(metrics.pciThroughput).toBeCloseTo(16, 1);
    });
  });
});
