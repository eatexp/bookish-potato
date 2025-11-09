# ADR-002: Plugin-Based Model Router Architecture

## Status
Proposed

## Context

The RTX 5090 Hybrid AI whitepaper defines a 5-tier escalation workflow for intelligent routing between local models and cloud APIs:

1. **Daily Driver**: Qwen3-Coder-30B (local, zero-cost)
2. **Complex Local Audits**: Llama 3.1 70B (local, higher capability)
3. **Novel Pattern Detection**: Claude 4.1 Opus (API, $15-20/M tokens)
4. **Quantum Code Analysis**: granite-8b-qiskit (local, specialized)
5. **Theoretical Review**: GPT-5 (API, frontier reasoning)

This workflow embodies the paper's core thesis: **maximize ROI by routing most tasks to local models, escalating to expensive APIs only for high-value tasks.**

### The Hardcoding Problem

Directly implementing this as a fixed 5-tier switch statement would:
- ❌ Fail in environments with different cost constraints (e.g., unlimited API budget vs zero API budget)
- ❌ Break when new models emerge (e.g., GPT-5 release, Llama 4, specialized domain models)
- ❌ Ignore organizational policies (e.g., HIPAA requiring all processing to be local)
- ❌ Prevent community contributions (users can't add custom routing logic)
- ❌ Require code changes for configuration adjustments (violates Open/Closed Principle)

### Real-World Routing Complexity

User interviews and whitepaper analysis reveal routing decisions depend on:

| Factor | Example Decision Logic |
|--------|------------------------|
| **Cost Budget** | If monthly API spend >$500, route to local; else use Claude API |
| **Data Sensitivity** | If contains PII/PHI, must route to local (compliance requirement) |
| **Latency Requirements** | If real-time (<2s), use local; batch jobs can use slower API |
| **Task Complexity** | If token count >8K, escalate to Claude 200K context window |
| **Accuracy vs Speed** | If production code review, use GPT-5; if prototyping, use local |
| **Geographic Constraints** | If EU data residency required, use local or EU-region APIs only |

A fixed 5-tier workflow cannot accommodate this diversity.

## Decision

**Implement a plugin-based routing engine with a declarative configuration DSL and cost-prediction simulation.**

### Architecture Overview

```typescript
// Core abstraction: Routers decide where to send requests
interface ModelRouter {
  /**
   * Determines the optimal model/API for a given request.
   * @param request - The inference request with context
   * @param options - Routing options (dry-run, cost limits, etc.)
   * @returns Route decision with cost estimate and rationale
   */
  route(request: InferenceRequest, options: RoutingOptions): Promise<RouteDecision>;
}

interface RouteDecision {
  target: ModelTarget;          // Where to send the request
  estimatedCost: number;         // In USD
  estimatedLatency: number;      // In seconds
  rationale: string;             // Human-readable explanation
  alternatives: RouteDecision[]; // Other viable options (for --explain mode)
}

interface ModelTarget {
  type: 'local' | 'api';
  provider: string;              // 'ollama' | 'anthropic' | 'openai'
  model: string;                 // 'qwen3-coder-30b' | 'claude-opus-4'
  endpoint?: string;             // Optional custom endpoint
}
```

### Plugin System Design

Users can implement custom routers by extending the base class:

```typescript
// Built-in router: Cost-aware escalation
export class CostAwareRouter extends BaseRouter {
  constructor(private config: CostConfig) {
    super();
  }

  async route(request: InferenceRequest): Promise<RouteDecision> {
    const monthlyCost = await this.getMonthlySpend();

    // Example policy: Stay under $100/month
    if (monthlyCost > this.config.monthlyBudget) {
      return this.routeToLocal(request, 'qwen3-coder-30b');
    }

    // Complexity-based escalation
    if (request.estimatedTokens > 16000) {
      return this.routeToAPI(request, 'claude-opus-4');
    }

    return this.routeToLocal(request, 'qwen3-coder-30b');
  }
}

// Custom user router: HIPAA compliance
export class HIPAARouter extends BaseRouter {
  async route(request: InferenceRequest): Promise<RouteDecision> {
    const containsPII = await this.detectPII(request.prompt);

    if (containsPII) {
      // HIPAA: Never send PHI to external APIs
      return this.routeToLocal(request, 'llama-3.1-70b');
    }

    // Non-sensitive data can use API for better quality
    return this.routeToAPI(request, 'claude-opus-4');
  }
}
```

### Declarative Configuration DSL

For users who don't want to write TypeScript, provide YAML-based routing rules:

```yaml
# ~/.config/hybrid-ai-workbench/routing.yml
router: cost-aware

routers:
  cost-aware:
    monthly_budget: 100  # USD
    default_local: qwen3-coder-30b
    escalation_rules:
      - if: tokens > 16000
        route: claude-opus-4
        reason: "Long context requires 200K window"

      - if: task_type == "quantum"
        route: granite-8b-qiskit
        reason: "Specialized quantum linting"

      - if: complexity > 0.8  # ML-based complexity score
        route: gpt-5
        reason: "Novel pattern detection requires frontier model"

  hipaa-compliant:
    # Never route externally
    allowed_targets: [local]
    default_local: llama-3.1-70b

  development:
    # Unlimited API for prototyping
    monthly_budget: 999999
    default_api: claude-opus-4
```

### Cost Prediction & Dry-Run Mode

Critical feature: Estimate costs before executing:

```bash
$ hybrid-ai-workbench route --dry-run "Review this 50K line codebase for SQL injection"

[DRY RUN] Route Decision:
Target: Claude Opus 4 (API)
Estimated Cost: $2.87 (estimated 143K tokens @ $15/M input + $75/M output)
Estimated Latency: 45 seconds
Rationale: Codebase size (50K lines) exceeds local model context window

Alternative Routes:
1. Llama 3.1 70B (local) - $0.00, 120s - Warning: May miss issues due to context limits
2. GPT-5 (API) - $4.12, 35s - Higher cost but better accuracy

Proceed with Claude Opus 4? [y/N]
```

## Rationale

### Why Plugin Architecture Wins

1. **Extensibility**: Users can add custom routing logic without forking the codebase
2. **Testability**: Each router is independently unit-testable
3. **Community Growth**: Plugin ecosystem enables community contributions
4. **Configuration Flexibility**: YAML config for non-developers, TypeScript for advanced users
5. **Future-Proof**: New models/APIs slot in without refactoring core logic

### Alignment with Software Engineering Principles

- **Open/Closed Principle**: Open for extension (new routers), closed for modification (core engine)
- **Single Responsibility**: Each router implements one policy (cost-aware, compliance, latency-optimized)
- **Dependency Inversion**: Core depends on `ModelRouter` interface, not concrete implementations
- **Strategy Pattern**: Runtime selection of routing algorithm

### Alignment with Whitepaper Thesis

The original whitepaper states:
> "The optimal strategy is not to pursue the largest possible local model, but to implement a flexible and powerful hybrid AI system."

Plugin architecture operationalizes "flexible" by allowing users to:
- Define custom flexibility (what "optimal" means in their context)
- Adapt to changing constraints (budget cuts, new compliance requirements)
- Experiment with routing strategies (A/B test different policies)

## Consequences

### Positive
- ✅ **Handles diverse use cases**: Research labs, enterprises, individual developers all configure differently
- ✅ **Community-driven innovation**: Users can share routers (npm packages, GitHub gists)
- ✅ **A/B testing enabled**: Run production with `router: cost-aware`, staging with `router: quality-first`
- ✅ **Transparent decision-making**: `--explain` flag shows why each routing decision was made
- ✅ **Cost control**: Dry-run mode prevents accidental $1000 API bills
- ✅ **Gradual adoption**: Start with simple built-in routers, migrate to custom as needs grow

### Negative
- ❌ **Increased complexity**: Plugin system adds ~500 LOC vs hardcoded switch
- ❌ **Documentation burden**: Must document plugin API, configuration DSL, examples
- ❌ **Breaking changes risk**: Plugin API must be stable (semver guarantees required)
- ❌ **Performance overhead**: Dynamic dispatch slower than hardcoded logic (negligible for I/O-bound tasks)

### Mitigations

1. **Complexity**: Ship 3 built-in routers covering 90% of use cases
   - `simple`: Always route to default local model (zero config)
   - `cost-aware`: Hybrid strategy from whitepaper (default choice)
   - `api-first`: Always use API (for unlimited budget users)

2. **Documentation**: Generate plugin template with `hybrid-ai-workbench router init my-router`

3. **Stability**: Lock plugin API in v1.0.0, use semver major bumps for breaking changes

4. **Performance**: Cache routing decisions for identical requests (LRU cache)

## Implementation Plan

### Phase 1: Core Engine (Week 1)
```typescript
// src/core/model-router.ts
export abstract class BaseRouter implements ModelRouter {
  abstract route(request: InferenceRequest, options: RoutingOptions): Promise<RouteDecision>;

  // Helper methods for common operations
  protected async estimateCost(target: ModelTarget, tokens: number): Promise<number> { }
  protected async getMonthlySpend(): Promise<number> { }
  protected routeToLocal(request, model): RouteDecision { }
  protected routeToAPI(request, model): RouteDecision { }
}

// Concrete implementation
export class CostAwareRouter extends BaseRouter { }
export class SimpleRouter extends BaseRouter { }  // Always local
export class APIFirstRouter extends BaseRouter { } // Always API
```

### Phase 2: Configuration DSL (Week 2)
```typescript
// src/config/routing-config.ts
export class RoutingConfigLoader {
  load(configPath: string): ModelRouter {
    const yaml = parseYAML(configPath);
    return this.instantiateRouter(yaml);
  }

  private instantiateRouter(config: any): ModelRouter {
    const RouterClass = this.routers.get(config.router);
    return new RouterClass(config.routers[config.router]);
  }
}
```

### Phase 3: Dry-Run & Explanation (Week 3)
```typescript
// src/commands/route.ts
export async function routeCommand(prompt: string, options: CLIOptions) {
  const router = loadConfiguredRouter();
  const decision = await router.route({ prompt }, { dryRun: options.dryRun });

  if (options.dryRun) {
    console.log(formatDryRunOutput(decision));
    const confirmed = await promptUser('Proceed? [y/N]');
    if (!confirmed) return;
  }

  await executeRoute(decision);
}
```

### Testing Strategy

```typescript
// tests/routers/cost-aware.test.ts
describe('CostAwareRouter', () => {
  it('routes to local when monthly budget exceeded', async () => {
    const router = new CostAwareRouter({ monthlyBudget: 100 });
    mockMonthlySpend(150); // Over budget

    const decision = await router.route({ prompt: 'test', estimatedTokens: 100 });

    expect(decision.target.type).toBe('local');
    expect(decision.target.model).toBe('qwen3-coder-30b');
    expect(decision.rationale).toContain('budget');
  });

  it('escalates to API for complex tasks under budget', async () => {
    const router = new CostAwareRouter({ monthlyBudget: 100 });
    mockMonthlySpend(10); // Under budget

    const decision = await router.route({ prompt: 'test', estimatedTokens: 20000 });

    expect(decision.target.type).toBe('api');
    expect(decision.target.model).toBe('claude-opus-4');
  });
});
```

## Alternatives Considered

### Alternative 1: Hardcoded 5-Tier Switch
**Approach**: Directly implement whitepaper workflow as if/else chain

```typescript
function route(request) {
  if (request.taskType === 'quantum') return 'granite-8b-qiskit';
  if (request.complexity > 0.8) return 'gpt-5';
  if (request.tokens > 16000) return 'claude-opus-4';
  if (request.needsDeepReasoning) return 'llama-3.1-70b';
  return 'qwen3-coder-30b';
}
```

**Rejected Because**:
- Impossible to adapt to different cost structures
- Requires code changes for every new model
- No way to enforce compliance policies (HIPAA, data residency)
- Prevents A/B testing different strategies

**When to Reconsider**: If 100% of users adopt the exact whitepaper workflow (unlikely)

### Alternative 2: AI-Powered Meta-Router
**Approach**: Use an LLM to dynamically choose the routing strategy

```typescript
async function route(request) {
  const metaPrompt = `Given this request, which model should handle it?
  Request: ${request.prompt}
  Available: qwen3-coder-30b (fast, free), claude-opus-4 (smart, $$$)`;

  const decision = await callLLM(metaPrompt);
  return decision.model;
}
```

**Rejected Because**:
- Introduces latency (LLM call before every request)
- Non-deterministic (same request could route differently)
- Requires API call even for local-only routing
- Debugging nightmare (can't reproduce routing decisions)

**When to Reconsider**: Phase 3 experimental feature for advanced users

### Alternative 3: Rules Engine (Drools-style)
**Approach**: Use a production rules engine with forward-chaining

**Rejected Because**:
- Overkill for routing logic (rules engines solve complex inference problems)
- Adds heavyweight dependency
- YAML config is sufficient for declarative rules

## Success Metrics

How we'll know this architecture is working:

- ✅ **Adoption**: 50%+ of users customize the default router within first month
- ✅ **Community**: 5+ community-contributed routers published to npm
- ✅ **Stability**: Zero breaking changes to plugin API in first 6 months
- ✅ **Performance**: Routing decision latency <50ms (vs ~30s for actual inference)
- ✅ **Cost Savings**: Users report 60%+ reduction in API spend vs naive "always Claude" approach

## References

- Original hybrid workflow: `Technical Whitepaper on Hybrid AI Model Configurations.txt` lines 92-101
- Strategy Pattern: Gang of Four Design Patterns
- Open/Closed Principle: Robert C. Martin, "Clean Architecture"
- Plugin architecture precedent: Webpack, Babel, ESLint

## Related ADRs

- **ADR-001**: Security model impacts router's ability to read cost tracking (must work without privileged access)
- **ADR-003**: GPU abstraction layer provides VRAM metrics that inform routing decisions

---

**Decision Date**: 2025-11-09
**Status**: Awaiting review and approval before implementation
**Author**: Architecture Review Process
