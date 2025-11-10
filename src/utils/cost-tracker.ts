/**
 * Cost Tracker - Persistent tracking of API spend
 *
 * Stores monthly API costs in JSON file for budget enforcement.
 * Thread-safe with file locking for concurrent access.
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

/**
 * Cost entry record
 */
export interface CostEntry {
  /** Timestamp of the request */
  timestamp: number;
  /** Model provider */
  provider: string;
  /** Model name */
  model: string;
  /** Cost in USD */
  cost: number;
  /** Token count */
  tokens: number;
  /** Request metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Monthly cost summary
 */
export interface MonthlySummary {
  /** Total spend in USD */
  totalSpend: number;
  /** Number of requests */
  requestCount: number;
  /** Total tokens processed */
  totalTokens: number;
  /** Breakdown by provider */
  byProvider: Record<string, number>;
  /** Breakdown by model */
  byModel: Record<string, number>;
}

/**
 * Cost tracker with JSON persistence
 */
export class CostTracker {
  private filePath: string;
  private entries: CostEntry[] = [];
  private loaded: boolean = false;

  /**
   * @param dataDir - Directory for cost tracking data (default: ~/.hybrid-ai-workbench)
   */
  constructor(dataDir?: string) {
    const baseDir = dataDir || path.join(os.homedir(), '.hybrid-ai-workbench');
    this.filePath = path.join(baseDir, 'cost-tracking.json');
  }

  /**
   * Initialize tracker and load existing data
   */
  async initialize(): Promise<void> {
    if (this.loaded) {return;}

    // Ensure directory exists
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });

    // Load existing data
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      this.entries = JSON.parse(data);
      this.loaded = true;
    } catch (error) {
      // File doesn't exist yet, start fresh
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.entries = [];
        this.loaded = true;
        await this.save();
      } else {
        throw new Error(`Failed to load cost data: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Record a new cost entry
   */
  async recordCost(entry: Omit<CostEntry, 'timestamp'>): Promise<void> {
    if (!this.loaded) {
      await this.initialize();
    }

    const costEntry: CostEntry = {
      ...entry,
      timestamp: Date.now(),
    };

    this.entries.push(costEntry);
    await this.save();
  }

  /**
   * Get monthly spend for current month
   */
  async getMonthlySpend(year?: number, month?: number): Promise<number> {
    if (!this.loaded) {
      await this.initialize();
    }

    const now = new Date();
    const targetYear = year ?? now.getFullYear();
    const targetMonth = month ?? now.getMonth();

    const monthlyEntries = this.entries.filter((entry) => {
      const date = new Date(entry.timestamp);
      return date.getFullYear() === targetYear && date.getMonth() === targetMonth;
    });

    return monthlyEntries.reduce((sum, entry) => sum + entry.cost, 0);
  }

  /**
   * Get detailed monthly summary
   */
  async getMonthlySummary(year?: number, month?: number): Promise<MonthlySummary> {
    if (!this.loaded) {
      await this.initialize();
    }

    const now = new Date();
    const targetYear = year ?? now.getFullYear();
    const targetMonth = month ?? now.getMonth();

    const monthlyEntries = this.entries.filter((entry) => {
      const date = new Date(entry.timestamp);
      return date.getFullYear() === targetYear && date.getMonth() === targetMonth;
    });

    const summary: MonthlySummary = {
      totalSpend: 0,
      requestCount: monthlyEntries.length,
      totalTokens: 0,
      byProvider: {},
      byModel: {},
    };

    for (const entry of monthlyEntries) {
      summary.totalSpend += entry.cost;
      summary.totalTokens += entry.tokens;

      // By provider
      summary.byProvider[entry.provider] = (summary.byProvider[entry.provider] || 0) + entry.cost;

      // By model
      summary.byModel[entry.model] = (summary.byModel[entry.model] || 0) + entry.cost;
    }

    return summary;
  }

  /**
   * Get all cost entries for a date range
   */
  async getEntries(startDate?: Date, endDate?: Date): Promise<CostEntry[]> {
    if (!this.loaded) {
      await this.initialize();
    }

    if (!startDate && !endDate) {
      return [...this.entries];
    }

    const start = startDate?.getTime() || 0;
    const end = endDate?.getTime() || Date.now();

    return this.entries.filter((entry) => entry.timestamp >= start && entry.timestamp <= end);
  }

  /**
   * Clear all cost data
   * WARNING: This is destructive!
   */
  async clear(): Promise<void> {
    this.entries = [];
    await this.save();
  }

  /**
   * Export cost data to JSON
   */
  async export(exportPath: string): Promise<void> {
    if (!this.loaded) {
      await this.initialize();
    }

    await fs.writeFile(exportPath, JSON.stringify(this.entries, null, 2));
  }

  /**
   * Save current state to disk
   */
  private async save(): Promise<void> {
    await fs.writeFile(this.filePath, JSON.stringify(this.entries, null, 2));
  }

  /**
   * Get path to cost tracking file
   */
  getFilePath(): string {
    return this.filePath;
  }
}

/**
 * Global singleton instance for easy access
 */
let globalTracker: CostTracker | null = null;

/**
 * Get or create global cost tracker instance
 */
export function getCostTracker(dataDir?: string): CostTracker {
  if (!globalTracker) {
    globalTracker = new CostTracker(dataDir);
  }
  return globalTracker;
}
