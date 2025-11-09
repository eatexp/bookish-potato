/**
 * Unit tests for SimulatedGPUProvider (Tier 3)
 */

import { SimulatedGPUProvider } from '../../src/providers/simulated-gpu-provider';
import { GPUMetrics } from '../../src/core/gpu-provider';

describe('SimulatedGPUProvider', () => {
  describe('Basic functionality', () => {
    it('should always be available', async () => {
      const provider = new SimulatedGPUProvider();
      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });

    it('should have correct tier and name', () => {
      const provider = new SimulatedGPUProvider();
      expect(provider.tier).toBe(3);
      expect(provider.name).toBe('Simulated');
    });
  });

  describe('Static metrics', () => {
    it('should return valid default metrics', async () => {
      const provider = new SimulatedGPUProvider();
      const metrics = await provider.getMetrics();

      expect(metrics.vramTotal).toBe(32);
      expect(metrics.vramUsed).toBe(8);
      expect(metrics.vramFree).toBe(24);
      expect(metrics.computeCapability).toBe('sm_120');
      expect(metrics.deviceName).toContain('RTX 5090');
      expect(metrics.deviceName).toContain('Simulated');
    });

    it('should include all optional metrics', async () => {
      const provider = new SimulatedGPUProvider();
      const metrics = await provider.getMetrics();

      expect(metrics.temperature).toBeDefined();
      expect(metrics.powerDraw).toBeDefined();
      expect(metrics.clockSpeed).toBeDefined();
      expect(metrics.eccEnabled).toBeDefined();
      expect(metrics.pciThroughput).toBeDefined();
      expect(metrics.utilizationGPU).toBeDefined();
      expect(metrics.utilizationMemory).toBeDefined();
    });

    it('should respect custom configuration', async () => {
      const provider = new SimulatedGPUProvider({
        deviceName: 'Custom GPU',
        vramTotal: 48,
        vramUsed: 12,
        computeCapability: 'sm_90',
      });

      const metrics = await provider.getMetrics();

      expect(metrics.vramTotal).toBe(48);
      expect(metrics.vramUsed).toBe(12);
      expect(metrics.vramFree).toBe(36);
      expect(metrics.computeCapability).toBe('sm_90');
      expect(metrics.deviceName).toContain('Custom GPU');
    });

    it('should return consistent metrics across multiple calls', async () => {
      const provider = new SimulatedGPUProvider();

      const metrics1 = await provider.getMetrics();
      const metrics2 = await provider.getMetrics();

      expect(metrics1.vramTotal).toBe(metrics2.vramTotal);
      expect(metrics1.vramUsed).toBe(metrics2.vramUsed);
      expect(metrics1.temperature).toBe(metrics2.temperature);
    });
  });

  describe('Dynamic metrics', () => {
    it('should vary metrics when dynamic mode enabled', async () => {
      const provider = new SimulatedGPUProvider({ dynamic: true });

      const metrics1 = await provider.getMetrics();
      // Wait a bit for metrics to change
      await new Promise((resolve) => setTimeout(resolve, 100));
      const metrics2 = await provider.getMetrics();

      // At least some metrics should differ
      const hasDifference =
        metrics1.vramUsed !== metrics2.vramUsed ||
        metrics1.temperature !== metrics2.temperature ||
        metrics1.powerDraw !== metrics2.powerDraw ||
        metrics1.utilizationGPU !== metrics2.utilizationGPU;

      expect(hasDifference).toBe(true);
    });

    it('should keep VRAM usage within bounds in dynamic mode', async () => {
      const provider = new SimulatedGPUProvider({
        vramTotal: 32,
        vramUsed: 8,
        dynamic: true,
      });

      // Check multiple samples
      for (let i = 0; i < 10; i++) {
        const metrics = await provider.getMetrics();
        expect(metrics.vramUsed).toBeGreaterThanOrEqual(0);
        expect(metrics.vramUsed).toBeLessThanOrEqual(32);
        expect(metrics.vramFree).toBeGreaterThanOrEqual(0);
        expect(metrics.vramFree).toBeLessThanOrEqual(32);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    });
  });

  describe('Validation', () => {
    it('should validate metrics consistency', async () => {
      const provider = new SimulatedGPUProvider();
      const metrics = await provider.getMetrics();

      // VRAM accounting should be correct
      expect(metrics.vramUsed + metrics.vramFree).toBeCloseTo(metrics.vramTotal, 1);
    });

    it('should reject invalid configuration', async () => {
      // Provider should handle this gracefully or validate in constructor
      const provider = new SimulatedGPUProvider({
        vramTotal: 32,
        vramUsed: 40, // More than total - should be clamped or error
      });

      // Should either throw or clamp to valid range
      const metricsPromise = provider.getMetrics();
      await expect(metricsPromise).rejects.toThrow();
    });
  });

  describe('Health check', () => {
    it('should report healthy status', async () => {
      const provider = new SimulatedGPUProvider();
      const health = await provider.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.reason).toContain('simulated');
    });

    it('should include warnings about simulated metrics', async () => {
      const provider = new SimulatedGPUProvider();
      const health = await provider.healthCheck();

      expect(health.warnings).toBeDefined();
      expect(health.warnings!.length).toBeGreaterThan(0);
      expect(health.warnings!.some((w) => w.includes('Simulated'))).toBe(true);
    });
  });

  describe('Memory utilization calculation', () => {
    it('should calculate memory utilization correctly', async () => {
      const provider = new SimulatedGPUProvider({
        vramTotal: 32,
        vramUsed: 8, // 25% utilization
      });

      const metrics = await provider.getMetrics();
      expect(metrics.utilizationMemory).toBe(25);
    });

    it('should handle different utilization levels', async () => {
      const testCases = [
        { total: 32, used: 0, expected: 0 },
        { total: 32, used: 16, expected: 50 },
        { total: 32, used: 32, expected: 100 },
        { total: 24, used: 6, expected: 25 },
      ];

      for (const testCase of testCases) {
        const provider = new SimulatedGPUProvider({
          vramTotal: testCase.total,
          vramUsed: testCase.used,
        });

        const metrics = await provider.getMetrics();
        expect(metrics.utilizationMemory).toBe(testCase.expected);
      }
    });
  });
});
