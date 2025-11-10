/**
 * Unit tests for Cost Tracker
 */

import { CostTracker } from '../../src/utils/cost-tracker';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('CostTracker', () => {
  let tracker: CostTracker;
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    testDir = path.join(os.tmpdir(), `cost-tracker-test-${Date.now()}`);
    tracker = new CostTracker(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      const files = await fs.readdir(testDir);
      for (const file of files) {
        await fs.unlink(path.join(testDir, file));
      }
      await fs.rmdir(testDir);
    } catch (error) {
      // Ignore if directory doesn't exist
    }
  });

  describe('recordCost', () => {
    it('should record a new cost entry', async () => {
      await tracker.recordCost({
        provider: 'openai',
        model: 'gpt-4',
        cost: 0.005,
        tokens: 150,
      });

      const summary = await tracker.getMonthlySummary();
      expect(summary.totalSpend).toBe(0.005);
      expect(summary.requestCount).toBe(1);
      expect(summary.totalTokens).toBe(150);
    });

    it('should record multiple cost entries', async () => {
      await tracker.recordCost({
        provider: 'openai',
        model: 'gpt-4',
        cost: 0.005,
        tokens: 150,
      });

      await tracker.recordCost({
        provider: 'anthropic',
        model: 'claude-opus-4',
        cost: 0.015,
        tokens: 300,
      });

      const summary = await tracker.getMonthlySummary();
      expect(summary.totalSpend).toBe(0.02);
      expect(summary.requestCount).toBe(2);
      expect(summary.totalTokens).toBe(450);
    });

    it('should persist entries to disk', async () => {
      await tracker.recordCost({
        provider: 'openai',
        model: 'gpt-4',
        cost: 0.005,
        tokens: 150,
      });

      // Create a new tracker instance with the same directory
      const tracker2 = new CostTracker(testDir);
      const summary = await tracker2.getMonthlySummary();
      expect(summary.totalSpend).toBe(0.005);
    });
  });

  describe('getMonthlySpend', () => {
    it('should return 0 for no entries', async () => {
      const spend = await tracker.getMonthlySpend();
      expect(spend).toBe(0);
    });

    it('should calculate monthly spend correctly', async () => {
      await tracker.recordCost({
        provider: 'openai',
        model: 'gpt-4',
        cost: 5.5,
        tokens: 150,
      });

      await tracker.recordCost({
        provider: 'openai',
        model: 'gpt-4',
        cost: 3.75,
        tokens: 150,
      });

      const spend = await tracker.getMonthlySpend();
      expect(spend).toBe(9.25);
    });

    it('should filter by specific month and year', async () => {
      // Record entry for current month
      await tracker.recordCost({
        provider: 'openai',
        model: 'gpt-4',
        cost: 5.0,
        tokens: 150,
      });

      const now = new Date();
      const spend = await tracker.getMonthlySpend(now.getFullYear(), now.getMonth());
      expect(spend).toBe(5.0);

      // Check a different month (should be 0)
      const differentMonth = await tracker.getMonthlySpend(2020, 0);
      expect(differentMonth).toBe(0);
    });
  });

  describe('getMonthlySummary', () => {
    it('should return empty summary for no entries', async () => {
      const summary = await tracker.getMonthlySummary();
      expect(summary.totalSpend).toBe(0);
      expect(summary.requestCount).toBe(0);
      expect(summary.totalTokens).toBe(0);
      expect(summary.byProvider).toEqual({});
      expect(summary.byModel).toEqual({});
    });

    it('should aggregate costs by provider', async () => {
      await tracker.recordCost({
        provider: 'openai',
        model: 'gpt-4',
        cost: 0.005,
        tokens: 150,
      });

      await tracker.recordCost({
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        cost: 0.001,
        tokens: 150,
      });

      await tracker.recordCost({
        provider: 'anthropic',
        model: 'claude-opus-4',
        cost: 0.015,
        tokens: 300,
      });

      const summary = await tracker.getMonthlySummary();
      expect(summary.byProvider['openai']).toBe(0.006);
      expect(summary.byProvider['anthropic']).toBe(0.015);
    });

    it('should aggregate costs by model', async () => {
      await tracker.recordCost({
        provider: 'openai',
        model: 'gpt-4',
        cost: 0.005,
        tokens: 150,
      });

      await tracker.recordCost({
        provider: 'openai',
        model: 'gpt-4',
        cost: 0.003,
        tokens: 150,
      });

      const summary = await tracker.getMonthlySummary();
      expect(summary.byModel['gpt-4']).toBe(0.008);
    });

    it('should filter by specific year and month', async () => {
      await tracker.recordCost({
        provider: 'openai',
        model: 'gpt-4',
        cost: 0.005,
        tokens: 150,
      });

      const now = new Date();
      const summary = await tracker.getMonthlySummary(now.getFullYear(), now.getMonth());
      expect(summary.totalSpend).toBe(0.005);

      // Different month should be empty
      const emptySummary = await tracker.getMonthlySummary(2020, 0);
      expect(emptySummary.totalSpend).toBe(0);
    });
  });

  describe('export', () => {
    it('should export entries to a file', async () => {
      await tracker.recordCost({
        provider: 'openai',
        model: 'gpt-4',
        cost: 0.005,
        tokens: 150,
      });

      const exportPath = path.join(testDir, 'export.json');
      await tracker.export(exportPath);

      // Verify file exists
      const fileContent = await fs.readFile(exportPath, 'utf-8');
      const data = JSON.parse(fileContent);
      expect(data).toHaveLength(1);
      expect(data[0].provider).toBe('openai');
    });
  });

  describe('getEntries', () => {
    it('should return all entries when no date range specified', async () => {
      await tracker.recordCost({
        provider: 'openai',
        model: 'gpt-4',
        cost: 0.005,
        tokens: 150,
      });

      const entries = await tracker.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].provider).toBe('openai');
    });

    it('should filter entries by date range', async () => {
      await tracker.recordCost({
        provider: 'openai',
        model: 'gpt-4',
        cost: 0.005,
        tokens: 150,
      });

      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const entries = await tracker.getEntries(yesterday, tomorrow);
      expect(entries).toHaveLength(1);
    });
  });

  describe('clear', () => {
    it('should clear all cost data', async () => {
      await tracker.recordCost({
        provider: 'openai',
        model: 'gpt-4',
        cost: 0.005,
        tokens: 150,
      });

      await tracker.clear();

      const summary = await tracker.getMonthlySummary();
      expect(summary.totalSpend).toBe(0);
      expect(summary.requestCount).toBe(0);
    });
  });

  describe('file handling', () => {
    it('should create directory if it does not exist', async () => {
      await tracker.recordCost({
        provider: 'openai',
        model: 'gpt-4',
        cost: 0.005,
        tokens: 150,
      });

      const exists = await fs
        .access(testDir)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should handle corrupted JSON file gracefully', async () => {
      // Initialize first to create the directory
      await tracker.recordCost({
        provider: 'openai',
        model: 'gpt-4',
        cost: 0.001,
        tokens: 50,
      });

      // Write invalid JSON to the file
      const filePath = tracker.getFilePath();
      await fs.writeFile(filePath, 'invalid json {{{', 'utf-8');

      // Create new tracker - should handle gracefully
      const tracker2 = new CostTracker(testDir);
      await expect(tracker2.getMonthlySummary()).rejects.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle zero cost entries', async () => {
      await tracker.recordCost({
        provider: 'ollama',
        model: 'llama-3.1-70b',
        cost: 0,
        tokens: 150,
      });

      const summary = await tracker.getMonthlySummary();
      expect(summary.totalSpend).toBe(0);
      expect(summary.requestCount).toBe(1);
    });

    it('should handle very large costs', async () => {
      await tracker.recordCost({
        provider: 'openai',
        model: 'gpt-5',
        cost: 999.99,
        tokens: 1500000,
      });

      const summary = await tracker.getMonthlySummary();
      expect(summary.totalSpend).toBe(999.99);
    });
  });

  describe('getFilePath', () => {
    it('should return the tracking file path', () => {
      const filePath = tracker.getFilePath();
      expect(filePath).toContain('cost-tracking.json');
      expect(filePath).toContain(testDir);
    });
  });
});
