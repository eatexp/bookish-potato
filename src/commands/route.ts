import { CostAwareRouter } from '../routers/cost-aware-router';
import { SimpleRouter } from '../routers/simple-router';
import { APIFirstRouter } from '../routers/api-first-router';
import { ModelRouter, RouteDecision } from '../core/model-router';
import { createProvider } from '../utils/provider-factory';
import { InferenceResponse } from '../core/model-provider';

interface RouteCommandOptions {
  dryRun?: boolean;
  explain?: boolean;
  router?: string;
  config?: string;
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export async function routeCommand(prompt: string, options: RouteCommandOptions): Promise<void> {
  try {
    // Select router based on options
    const router = selectRouter(options.router || 'cost-aware', options.config);

    // Estimate token count (simple heuristic: ~1 token per 4 characters)
    const estimatedTokens = Math.ceil(prompt.length / 4);

    // Route the request
    const decision = await router.route(
      {
        prompt,
        estimatedTokens,
      },
      {
        dryRun: options.dryRun,
        explain: options.explain,
      }
    );

    // Display the decision
    if (options.dryRun) {
      displayDryRunDecision(decision, prompt);

      // In dry-run mode, ask for confirmation
      if (decision.target.type === 'api' && decision.estimatedCost > 0) {
        console.log('\nThis is a dry-run. No action will be taken.');
        console.log('To execute, run without --dry-run flag.');
      }
    } else {
      displayDecision(decision);

      // Execute inference
      console.log('\n' + '═'.repeat(65));
      console.log('  Executing Inference');
      console.log('═'.repeat(65));
      console.log();

      const result = await executeInference(decision, prompt, options);

      // Display results
      displayInferenceResult(result, decision);

      // Record cost if using cost-aware router
      if (router instanceof CostAwareRouter && result.finishReason !== 'error') {
        await recordCost(router, decision, result);
      }
    }

    // Display alternatives if explain mode is enabled
    if (options.explain && decision.alternatives && decision.alternatives.length > 0) {
      displayAlternatives(decision.alternatives);
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
 * Select router based on name and optional config
 */
function selectRouter(routerName: string, _configPath?: string): ModelRouter {
  // TODO: Load from YAML config if _configPath provided

  switch (routerName.toLowerCase()) {
    case 'simple':
      return new SimpleRouter();

    case 'cost-aware':
      return new CostAwareRouter({ monthlyBudget: 100 }); // Default budget

    case 'api-first':
      return new APIFirstRouter();

    default:
      throw new Error(`Unknown router: ${routerName}. Available: simple, cost-aware, api-first`);
  }
}

/**
 * Display routing decision in dry-run mode
 */
function displayDryRunDecision(decision: RouteDecision, prompt: string): void {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  [DRY RUN] Route Decision');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();

  console.log('Prompt:', prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''));
  console.log();

  console.log('Target:');
  console.log(`  Type:              ${decision.target.type.toUpperCase()}`);
  console.log(`  Provider:          ${decision.target.provider}`);
  console.log(`  Model:             ${decision.target.model}`);
  console.log();

  console.log('Estimates:');
  if (decision.estimatedCost > 0) {
    console.log(`  Cost:              $${decision.estimatedCost.toFixed(4)}`);
  } else {
    console.log(`  Cost:              $0.00 (local)`);
  }
  console.log(`  Latency:           ~${decision.estimatedLatency.toFixed(1)}s`);
  if (decision.confidence) {
    console.log(`  Confidence:        ${(decision.confidence * 100).toFixed(0)}%`);
  }
  console.log();

  console.log('Rationale:');
  console.log(`  ${decision.rationale}`);
  console.log();

  console.log('═══════════════════════════════════════════════════════════════');
}

/**
 * Display routing decision in normal mode
 */
function displayDecision(decision: RouteDecision): void {
  console.log('Routing to:', decision.target.provider, '/', decision.target.model);
  console.log('Rationale:', decision.rationale);
  if (decision.estimatedCost > 0) {
    console.log('Estimated cost: $' + decision.estimatedCost.toFixed(4));
  }
}

/**
 * Display alternative routing options
 */
function displayAlternatives(alternatives: RouteDecision[]): void {
  console.log();
  console.log('Alternative Routes:');
  console.log('─'.repeat(65));

  alternatives.forEach((alt, index) => {
    console.log();
    console.log(`${index + 1}. ${alt.target.provider}/${alt.target.model} (${alt.target.type})`);
    console.log(`   Cost: $${alt.estimatedCost.toFixed(4)}, Latency: ~${alt.estimatedLatency.toFixed(1)}s`);
    console.log(`   ${alt.rationale}`);
  });

  console.log();
  console.log('─'.repeat(65));
}

/**
 * Execute inference using the selected provider
 */
async function executeInference(
  decision: RouteDecision,
  prompt: string,
  options: RouteCommandOptions
): Promise<InferenceResponse> {
  try {
    // Create provider instance
    const provider = createProvider(decision.target.provider);

    // Check if provider is available
    const available = await provider.isAvailable();
    if (!available) {
      throw new Error(
        `Provider ${decision.target.provider} is not available. ` +
          (decision.target.provider === 'ollama'
            ? 'Make sure Ollama is running (ollama serve)'
            : `Make sure ${decision.target.provider.toUpperCase()}_API_KEY is set`)
      );
    }

    // Execute inference
    if (options.stream) {
      return await executeStreamingInference(
        provider,
        decision.target.model,
        prompt,
        options
      );
    } else {
      return await provider.generate(decision.target.model, {
        prompt,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      });
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Inference failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Execute streaming inference with live output
 */
async function executeStreamingInference(
  provider: any,
  model: string,
  prompt: string,
  options: RouteCommandOptions
): Promise<InferenceResponse> {
  console.log('Response (streaming):');
  console.log('─'.repeat(65));
  console.log();

  const generator = provider.generateStream(model, {
    prompt,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  });

  let result: InferenceResponse | undefined;

  for await (const chunk of generator) {
    if ('text' in chunk && 'done' in chunk) {
      // Stream chunk
      process.stdout.write(chunk.text);
    } else {
      // Final result
      result = chunk;
    }
  }

  console.log();
  console.log();
  console.log('─'.repeat(65));

  if (!result) {
    throw new Error('Streaming completed without final result');
  }

  return result;
}

/**
 * Display inference result
 */
function displayInferenceResult(result: InferenceResponse, decision: RouteDecision): void {
  if (result.finishReason === 'error') {
    console.log('\n⚠️  Error:', result.error || 'Unknown error');
    return;
  }

  // For non-streaming, display the response
  if (result.text && !result.error) {
    console.log('Response:');
    console.log('─'.repeat(65));
    console.log();
    console.log(result.text);
    console.log();
    console.log('─'.repeat(65));
  }

  console.log();
  console.log('Statistics:');
  console.log(`  Model:             ${result.model}`);
  console.log(`  Provider:          ${result.provider}`);
  console.log(`  Tokens (prompt):   ${result.promptTokens}`);
  console.log(`  Tokens (response): ${result.completionTokens}`);
  console.log(`  Total tokens:      ${result.totalTokens}`);
  console.log(`  Latency:           ${(result.latencyMs / 1000).toFixed(2)}s`);
  console.log(`  Finish reason:     ${result.finishReason}`);

  // Calculate actual cost for API providers
  if (decision.target.type === 'api') {
    // Use the estimated cost from routing decision as actual cost approximation
    console.log(`  Actual cost:       ~$${decision.estimatedCost.toFixed(4)}`);
  } else {
    console.log(`  Cost:              $0.00 (local)`);
  }

  console.log();
  console.log('═'.repeat(65));
}

/**
 * Record cost in cost tracker
 */
async function recordCost(
  router: CostAwareRouter,
  decision: RouteDecision,
  result: InferenceResponse
): Promise<void> {
  if (decision.target.type === 'local' || decision.estimatedCost === 0) {
    return; // No cost to record for local models
  }

  try {
    const costTracker = (router as any).costTracker;
    if (costTracker) {
      await costTracker.recordCost({
        provider: decision.target.provider,
        model: decision.target.model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.totalTokens,
        cost: decision.estimatedCost,
      });

      const monthlySpend = await costTracker.getMonthlySpend();
      const remaining = (router as any).config.monthlyBudget - monthlySpend;

      console.log('Budget Status:');
      console.log(`  Monthly spend:     $${monthlySpend.toFixed(2)}`);
      console.log(`  Remaining budget:  $${remaining.toFixed(2)}`);
      console.log();
    }
  } catch (error) {
    // Don't fail the command if cost tracking fails
    console.warn('Warning: Failed to record cost:', error);
  }
}
