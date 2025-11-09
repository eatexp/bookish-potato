import { CostAwareRouter } from '../routers/cost-aware-router';
import { SimpleRouter } from '../routers/simple-router';
import { APIFirstRouter } from '../routers/api-first-router';
import { ModelRouter, RouteDecision } from '../core/model-router';

interface RouteCommandOptions {
  dryRun?: boolean;
  explain?: boolean;
  router?: string;
  config?: string;
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

      // Placeholder for actual execution
      console.log('\n⚠️  Model execution not yet implemented.');
      console.log('This would execute the request using:', decision.target.provider);
      console.log(
        'Estimated cost: $' + decision.estimatedCost.toFixed(4)
      );
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
