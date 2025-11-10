/**
 * Tests for BaseGPUProvider abstract class methods
 *
 * These tests cover the shared functionality in BaseGPUProvider
 * including healthCheck, validateMetrics, and parseComputeCapability.
 */

import { BaseGPUProvider, GPUMetrics, HealthCheckResult } from '../../src/core/gpu-provider';

/**
 * Concrete test implementation of BaseGPUProvider
 */
class TestGPUProvider extends BaseGPUProvider {
  readonly name = 'test-gpu-provider';
  readonly tier = 3 as const;

  private _metrics: GPUMetrics | null;
  private _shouldThrow: boolean;

  constructor(metrics: GPUMetrics | null = null) {
    super();
    this._metrics = metrics;
    this._shouldThrow = false;
  }

  setMetrics(metrics: GPUMetrics | null): void {
    this._metrics = metrics;
  }

  setShouldThrow(shouldThrow: boolean): void {
    this._shouldThrow = shouldThrow;
  }

  async isAvailable(): Promise<boolean> {
    return this._metrics !== null;
  }

  async getMetrics(): Promise<GPUMetrics> {
    if (this._shouldThrow) {
      throw new Error('Failed to get GPU metrics');
    }
    if (!this._metrics) {
      throw new Error('GPU not available');
    }
    return this._metrics;
  }

  async cleanup(): Promise<void> {
    // Test cleanup implementation
  }

  // Expose protected methods for testing
  public testValidateMetrics(metrics: GPUMetrics): void {
    this.validateMetrics(metrics);
  }

  public testParseComputeCapability(raw: string): string {
    return this.parseComputeCapability(raw);
  }
}

describe('BaseGPUProvider', () => {
  const validMetrics: GPUMetrics = {
    name: 'Test GPU',
    arch: 'Test Arch',
    computeCapability: 'sm_90',
    vramTotal: 24.0,
    vramUsed: 10.0,
    vramFree: 14.0,
    vramUsagePercent: 41.67,
    vramAvailable: 14.0,
    utilization: 75,
    temperature: 65,
    powerDraw: 300,
    powerLimit: 450,
    pcieGen: 4,
    pcieLinkWidth: 16,
  };

  describe('healthCheck()', () => {
    it('should return healthy when metrics are available', async () => {
      const provider = new TestGPUProvider(validMetrics);

      const health = await provider.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.reason).toBeUndefined();
    });

    it('should return unhealthy when getMetrics throws error', async () => {
      const provider = new TestGPUProvider(null);

      const health = await provider.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.reason).toBe('GPU not available');
    });

    it('should handle Error instances', async () => {
      const provider = new TestGPUProvider(validMetrics);
      provider.setShouldThrow(true);

      const health = await provider.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.reason).toBe('Failed to get GPU metrics');
    });

    it('should handle non-Error exceptions', async () => {
      const provider = new TestGPUProvider(validMetrics);
      // Override getMetrics to throw a non-Error
      provider.getMetrics = async () => {
        throw 'String error'; // eslint-disable-line @typescript-eslint/no-throw-literal
      };

      const health = await provider.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.reason).toBe('Unknown error');
    });
  });

  describe('validateMetrics()', () => {
    it('should not throw for valid metrics', () => {
      const provider = new TestGPUProvider(validMetrics);

      expect(() => {
        provider.testValidateMetrics(validMetrics);
      }).not.toThrow();
    });

    it('should throw when vramTotal is zero', () => {
      const provider = new TestGPUProvider(validMetrics);
      const invalidMetrics = { ...validMetrics, vramTotal: 0 };

      expect(() => {
        provider.testValidateMetrics(invalidMetrics);
      }).toThrow('Invalid vramTotal: must be > 0');
    });

    it('should throw when vramTotal is negative', () => {
      const provider = new TestGPUProvider(validMetrics);
      const invalidMetrics = { ...validMetrics, vramTotal: -1 };

      expect(() => {
        provider.testValidateMetrics(invalidMetrics);
      }).toThrow('Invalid vramTotal: must be > 0');
    });

    it('should throw when vramUsed is negative', () => {
      const provider = new TestGPUProvider(validMetrics);
      const invalidMetrics = { ...validMetrics, vramUsed: -5 };

      expect(() => {
        provider.testValidateMetrics(invalidMetrics);
      }).toThrow('Invalid vramUsed: -5');
    });

    it('should throw when vramUsed exceeds vramTotal', () => {
      const provider = new TestGPUProvider(validMetrics);
      const invalidMetrics = { ...validMetrics, vramUsed: 30.0, vramTotal: 24.0 };

      expect(() => {
        provider.testValidateMetrics(invalidMetrics);
      }).toThrow('Invalid vramUsed: 30');
    });

    it('should throw when vramFree is negative', () => {
      const provider = new TestGPUProvider(validMetrics);
      const invalidMetrics = { ...validMetrics, vramFree: -2 };

      expect(() => {
        provider.testValidateMetrics(invalidMetrics);
      }).toThrow('Invalid vramFree: -2');
    });

    it('should throw when vramFree exceeds vramTotal', () => {
      const provider = new TestGPUProvider(validMetrics);
      const invalidMetrics = { ...validMetrics, vramFree: 25.0, vramTotal: 24.0 };

      expect(() => {
        provider.testValidateMetrics(invalidMetrics);
      }).toThrow('Invalid vramFree: 25');
    });

    it('should throw when vramUsed + vramFree != vramTotal', () => {
      const provider = new TestGPUProvider(validMetrics);
      // Used: 10, Free: 10, Total: 24 -> mismatch
      const invalidMetrics = { ...validMetrics, vramUsed: 10.0, vramFree: 10.0, vramTotal: 24.0 };

      expect(() => {
        provider.testValidateMetrics(invalidMetrics);
      }).toThrow('VRAM accounting mismatch');
    });

    it('should allow small floating-point errors', () => {
      const provider = new TestGPUProvider(validMetrics);
      // Floating-point error: 10.0 + 14.05 = 24.05 (diff = 0.05 < 0.1)
      const metricsWithFloatError = {
        ...validMetrics,
        vramUsed: 10.0,
        vramFree: 14.05,
        vramTotal: 24.0,
      };

      expect(() => {
        provider.testValidateMetrics(metricsWithFloatError);
      }).not.toThrow();
    });

    it('should reject large floating-point errors', () => {
      const provider = new TestGPUProvider(validMetrics);
      // Large error: 10.0 + 14.2 = 24.2 (diff = 0.2 > 0.1)
      const metricsWithLargeError = {
        ...validMetrics,
        vramUsed: 10.0,
        vramFree: 14.2,
        vramTotal: 24.0,
      };

      expect(() => {
        provider.testValidateMetrics(metricsWithLargeError);
      }).toThrow('VRAM accounting mismatch');
    });

    it('should validate exact VRAM accounting', () => {
      const provider = new TestGPUProvider(validMetrics);
      const exactMetrics = {
        ...validMetrics,
        vramUsed: 15.5,
        vramFree: 8.5,
        vramTotal: 24.0,
      };

      expect(() => {
        provider.testValidateMetrics(exactMetrics);
      }).not.toThrow();
    });
  });

  describe('parseComputeCapability()', () => {
    it('should pass through sm_XX format unchanged', () => {
      const provider = new TestGPUProvider(validMetrics);

      expect(provider.testParseComputeCapability('sm_90')).toBe('sm_90');
      expect(provider.testParseComputeCapability('sm_120')).toBe('sm_120');
      expect(provider.testParseComputeCapability('sm_61')).toBe('sm_61');
    });

    it('should convert decimal format to sm_XX', () => {
      const provider = new TestGPUProvider(validMetrics);

      expect(provider.testParseComputeCapability('9.0')).toBe('sm_90');
      expect(provider.testParseComputeCapability('8.6')).toBe('sm_86');
      expect(provider.testParseComputeCapability('7.5')).toBe('sm_75');
    });

    it('should handle single digit versions', () => {
      const provider = new TestGPUProvider(validMetrics);

      expect(provider.testParseComputeCapability('3.5')).toBe('sm_35');
      expect(provider.testParseComputeCapability('6.1')).toBe('sm_61');
    });

    it('should handle formats without decimal points', () => {
      const provider = new TestGPUProvider(validMetrics);

      // No decimal point - just prepends sm_
      expect(provider.testParseComputeCapability('90')).toBe('sm_90');
      expect(provider.testParseComputeCapability('86')).toBe('sm_86');
    });

    it('should handle arbitrary strings', () => {
      const provider = new TestGPUProvider(validMetrics);

      // Any string that doesn't start with sm_ gets sm_ prepended
      expect(provider.testParseComputeCapability('invalid')).toBe('sm_invalid');
      expect(provider.testParseComputeCapability('abc')).toBe('sm_abc');
    });

    it('should handle empty string', () => {
      const provider = new TestGPUProvider(validMetrics);

      expect(provider.testParseComputeCapability('')).toBe('sm_');
    });

    it('should handle multiple decimal points', () => {
      const provider = new TestGPUProvider(validMetrics);

      // Only removes first dot
      expect(provider.testParseComputeCapability('9.0.1')).toBe('sm_90.1');
      expect(provider.testParseComputeCapability('1.2.3')).toBe('sm_12.3');
    });
  });
});
