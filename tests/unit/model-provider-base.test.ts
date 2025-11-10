/**
 * Tests for BaseModelProvider abstract class methods
 *
 * These tests cover the shared functionality in BaseModelProvider
 * including healthCheck, estimateTokens, and validateModel.
 */

import {
  BaseModelProvider,
  ModelProviderConfig,
  InferenceParams,
  InferenceResponse,
  StreamChunk,
  ProviderHealth,
} from '../../src/core/model-provider';

/**
 * Concrete test implementation of BaseModelProvider
 */
class TestModelProvider extends BaseModelProvider {
  readonly name = 'test-provider';
  readonly type = 'api' as const;

  private _available: boolean;
  private _models: string[];
  private _shouldThrow: boolean;

  constructor(config: ModelProviderConfig, available = true, models: string[] = ['model-1', 'model-2']) {
    super(config);
    this._available = available;
    this._models = models;
    this._shouldThrow = false;
  }

  setAvailable(available: boolean): void {
    this._available = available;
  }

  setModels(models: string[]): void {
    this._models = models;
  }

  setShouldThrow(shouldThrow: boolean): void {
    this._shouldThrow = shouldThrow;
  }

  async isAvailable(): Promise<boolean> {
    if (this._shouldThrow) {
      throw new Error('Simulated error in isAvailable');
    }
    return this._available;
  }

  async listModels(): Promise<string[]> {
    if (this._shouldThrow) {
      throw new Error('Simulated error in listModels');
    }
    return this._models;
  }

  async generate(_model: string, _params: InferenceParams): Promise<InferenceResponse> {
    return {
      text: 'test response',
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
      latencyMs: 100,
      model: 'test-model',
      provider: this.name,
      finishReason: 'completed',
    };
  }

  async *generateStream(
    _model: string,
    _params: InferenceParams
  ): AsyncGenerator<StreamChunk, InferenceResponse, undefined> {
    yield { text: 'chunk1', done: false, model: 'test-model' };
    yield { text: 'chunk2', done: false, model: 'test-model' };

    return {
      text: 'chunk1chunk2',
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
      latencyMs: 100,
      model: 'test-model',
      provider: this.name,
      finishReason: 'completed',
    };
  }
}

describe('BaseModelProvider', () => {
  describe('healthCheck()', () => {
    it('should return healthy when provider is available', async () => {
      const provider = new TestModelProvider({}, true, ['model-1', 'model-2']);

      const health = await provider.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
      expect(health.modelCount).toBe(2);
      expect(health.error).toBeUndefined();
    });

    it('should return unhealthy when provider is not available', async () => {
      const provider = new TestModelProvider({}, false);

      const health = await provider.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.error).toBe('Provider test-provider is not available');
      expect(health.modelCount).toBeUndefined();
    });

    it('should return unhealthy when isAvailable throws error', async () => {
      const provider = new TestModelProvider({});
      provider.setShouldThrow(true);

      const health = await provider.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.error).toBe('Simulated error in isAvailable');
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should return unhealthy when listModels throws error', async () => {
      const provider = new TestModelProvider({}, true, []);
      // Make listModels throw but isAvailable succeed
      const originalListModels = provider.listModels.bind(provider);
      provider.listModels = async () => {
        throw new Error('List models failed');
      };

      const health = await provider.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.error).toBe('List models failed');
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle non-Error exceptions', async () => {
      const provider = new TestModelProvider({}, true, []);
      provider.listModels = async () => {
        throw 'String error'; // eslint-disable-line @typescript-eslint/no-throw-literal
      };

      const health = await provider.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.error).toBe('Unknown error');
    });

    it('should measure latency correctly', async () => {
      const provider = new TestModelProvider({}, true, ['model-1', 'model-2', 'model-3']);

      const startTime = Date.now();
      const health = await provider.healthCheck();
      const endTime = Date.now();

      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
      expect(health.latencyMs).toBeLessThanOrEqual(endTime - startTime + 10); // 10ms tolerance
    });
  });

  describe('estimateTokens()', () => {
    it('should estimate tokens correctly for simple text', () => {
      const provider = new TestModelProvider({});

      // Access protected method via any for testing
      const estimate = (provider as any).estimateTokens('Hello world');

      // "Hello world" = 11 characters / 4 = 2.75, ceil = 3
      expect(estimate).toBe(3);
    });

    it('should estimate tokens for empty string', () => {
      const provider = new TestModelProvider({});

      const estimate = (provider as any).estimateTokens('');

      expect(estimate).toBe(0);
    });

    it('should estimate tokens for long text', () => {
      const provider = new TestModelProvider({});
      const longText = 'a'.repeat(1000);

      const estimate = (provider as any).estimateTokens(longText);

      // 1000 / 4 = 250
      expect(estimate).toBe(250);
    });

    it('should use ceiling for fractional results', () => {
      const provider = new TestModelProvider({});

      // 10 characters / 4 = 2.5, ceil = 3
      const estimate = (provider as any).estimateTokens('0123456789');

      expect(estimate).toBe(3);
    });
  });

  describe('validateModel()', () => {
    it('should not throw when model exists', async () => {
      const provider = new TestModelProvider({}, true, ['model-1', 'model-2', 'model-3']);

      await expect(
        (provider as any).validateModel('model-2')
      ).resolves.not.toThrow();
    });

    it('should throw when model does not exist', async () => {
      const provider = new TestModelProvider({}, true, ['model-1', 'model-2']);

      await expect(
        (provider as any).validateModel('nonexistent-model')
      ).rejects.toThrow('Model nonexistent-model not found');
    });

    it('should include available models in error message', async () => {
      const provider = new TestModelProvider({}, true, ['model-1', 'model-2', 'model-3']);

      await expect(
        (provider as any).validateModel('bad-model')
      ).rejects.toThrow('Available models: model-1, model-2, model-3');
    });

    it('should handle empty model list', async () => {
      const provider = new TestModelProvider({}, true, []);

      await expect(
        (provider as any).validateModel('any-model')
      ).rejects.toThrow('Model any-model not found. Available models:');
    });

    it('should be case-sensitive', async () => {
      const provider = new TestModelProvider({}, true, ['Model-1', 'model-2']);

      // Should fail for different case
      await expect(
        (provider as any).validateModel('model-1')
      ).rejects.toThrow();

      // Should succeed for exact match
      await expect(
        (provider as any).validateModel('Model-1')
      ).resolves.not.toThrow();
    });
  });
});
