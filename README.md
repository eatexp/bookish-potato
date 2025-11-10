# Hybrid AI Workbench

[![Tests](https://img.shields.io/badge/tests-193%20passing-brightgreen)](tests/)
[![Coverage](https://img.shields.io/badge/coverage-87%25-brightgreen)](coverage/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A production-ready AI routing and execution system that intelligently balances **cost**, **quality**, and **latency** by orchestrating between local GPU models and cloud APIs. Built with **TypeScript** and designed for enterprise-grade reliability.

## Features

- **Full Inference Execution**: Routes AND executes requests on local models (Ollama) and cloud APIs (Anthropic, OpenAI)
- **Streaming Support**: Real-time streaming output with AsyncGenerator for immediate feedback
- **YAML Configuration**: Persistent configuration files with environment variable expansion for routers, providers, and defaults
- **5-Tier Model Escalation**: Automatically routes tasks from local models (Qwen3, Llama 3.1 70B) to cloud APIs (Claude Opus, GPT-5) based on complexity, context size, and budget
- **Budget Enforcement**: Track monthly API spend with persistent cost tracking and automatic fallback to local models when budget limits are reached
- **Three-Tier GPU Abstraction**: NVML native bindings → nvidia-smi CLI parsing → simulated provider for testing/development
- **Pluggable Router Architecture**: Choose from `simple` (always local), `cost-aware` (budget-optimized), or `api-first` (quality-first) strategies
- **Docker/WSL Aware**: Automatically detects containerized environments and reorders GPU provider fallbacks
- **Rich CLI Interface**: Interactive commands with dry-run mode, explain mode, watch mode, and streaming
- **Type-Safe**: Full TypeScript strict mode with comprehensive type definitions
- **Well-Tested**: 193 unit tests with 87% code coverage

## Quick Start

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Check GPU status
npm run cli -- gpu-info

# Execute inference with intelligent routing
npm run cli -- route "Implement a binary search tree in Rust"

# Stream responses in real-time
npm run cli -- route "Explain quantum computing" --stream

# Dry-run to see routing decision without execution
npm run cli -- route "Complex task" --dry-run --explain

# Watch GPU metrics in real-time
npm run cli -- gpu-info --watch --interval 2
```

## Architecture

### GPU Provider Abstraction

The system implements a **three-tier fallback** for GPU detection:

```
Tier 1: NVML Provider (native bindings via node-nvidia-smi)
   ↓ (if unavailable)
Tier 2: nvidia-smi Provider (CLI parsing)
   ↓ (if unavailable)
Tier 3: Simulated Provider (testing/development)
```

**Why this matters**: In Docker/WSL environments, NVML bindings may fail even when nvidia-smi works. The system automatically detects the environment and uses the best available provider.

```typescript
import { createGPUDetector } from './utils/gpu-factory';

const detector = await createGPUDetector({
  dockerAware: true, // Auto-reorder providers for containers
});

const metrics = await detector.getMetrics();
console.log(metrics.vramUsagePercent); // 45.2
```

### Model Router Strategies

#### 1. SimpleRouter (Always Local)

Best for: **Privacy-conscious users**, **offline environments**, **zero-cost requirements**

```typescript
import { SimpleRouter } from './routers/simple-router';

const router = new SimpleRouter({
  defaultModel: 'qwen3-coder-30b',
  defaultProvider: 'ollama',
});

const decision = await router.route({
  prompt: 'Review this code for bugs',
  estimatedTokens: 2000,
});

// Always routes to local models
console.log(decision.target.type); // 'local'
console.log(decision.estimatedCost); // 0
```

#### 2. CostAwareRouter (Budget-Optimized)

Best for: **Cost-conscious teams**, **monthly budget limits**, **smart escalation**

Implements the **5-tier escalation workflow**:

1. **Tier 1** (Daily Driver): Qwen3-Coder-30B for simple tasks
2. **Tier 2** (Complex Local): Llama 3.1 70B for moderate complexity
3. **Tier 3** (Large Context): Claude Opus for 16K+ token contexts
4. **Tier 4** (Specialized): granite-8b-qiskit for quantum computing tasks
5. **Tier 5** (Frontier): GPT-5 for highest complexity reasoning

```typescript
import { CostAwareRouter } from './routers/cost-aware-router';

const router = new CostAwareRouter({
  monthlyBudget: 100, // $100/month limit
  complexityThreshold: 0.8, // Escalate to GPT-5 above this
  tokenThreshold: 16000, // Use Claude Opus for large contexts
});

// Simple task → Tier 1 (local)
const decision1 = await router.route({
  prompt: 'Format this JSON',
  estimatedTokens: 500,
  complexity: 0.2,
});
console.log(decision1.target.model); // 'qwen3-coder-30b'

// Large context → Tier 3 (API)
const decision2 = await router.route({
  prompt: 'Summarize this 50-page document',
  estimatedTokens: 25000,
});
console.log(decision2.target.model); // 'claude-opus-4'

// High complexity → Tier 5 (API)
const decision3 = await router.route({
  prompt: 'Design a novel distributed consensus algorithm',
  estimatedTokens: 5000,
  complexity: 0.9,
});
console.log(decision3.target.model); // 'gpt-5'

// Check budget status
const spent = await router.getMonthlySpend();
const remaining = await router.getRemainingBudget();
console.log(`Spent: $${spent.toFixed(2)} / Remaining: $${remaining.toFixed(2)}`);
```

**Budget enforcement**: When monthly spend exceeds the budget, all requests automatically fall back to local models with a clear rationale.

#### 3. APIFirstRouter (Quality-First)

Best for: **Unlimited budgets**, **maximum quality**, **production applications**

```typescript
import { APIFirstRouter } from './routers/api-first-router';

const router = new APIFirstRouter({
  defaultModel: 'claude-opus-4',
  defaultProvider: 'anthropic',
});

const decision = await router.route({
  prompt: 'Generate a comprehensive API design document',
  estimatedTokens: 8000,
});

// Prefers API models for best quality
console.log(decision.target.type); // 'api'
console.log(decision.target.model); // 'claude-opus-4'
```

## CLI Commands

### `gpu-info` - GPU Monitoring

```bash
# Basic GPU status
npm run cli -- gpu-info

# Output:
═══════════════════════════════════════════════════════════════
  GPU Information (Provider: NVML)
═══════════════════════════════════════════════════════════════

Name:                    NVIDIA GeForce RTX 5090
Architecture:            Blackwell (sm_120)
VRAM:                    24.0 GiB total / 18.5 GiB used (77.1%)
Utilization:             85%
Temperature:             72°C
Power:                   425W / 600W (70.8%)
PCIe:                    Gen4 x16

═══════════════════════════════════════════════════════════════

# Watch mode (updates every 2 seconds)
npm run cli -- gpu-info --watch --interval 2

# JSON output for scripting
npm run cli -- gpu-info --json
```

### `route` - Intelligent Routing & Execution

```bash
# Execute inference with intelligent routing
npm run cli -- route "Implement OAuth2 flow in Python"

# Stream responses in real-time
npm run cli -- route "Explain quantum computing" --stream

# Control generation parameters
npm run cli -- route "Write a poem" --temperature 1.5 --max-tokens 500

# Dry-run mode (shows decision without execution)
npm run cli -- route "Implement OAuth2 flow in Python" --dry-run

# Output:
═══════════════════════════════════════════════════════════════
  [DRY RUN] Route Decision
═══════════════════════════════════════════════════════════════

Prompt: Implement OAuth2 flow in Python

Target:
  Type:              LOCAL
  Provider:          ollama
  Model:             llama-3.1-70b

Estimates:
  Cost:              $0.00 (local)
  Latency:           ~3.2s
  Confidence:        85%

Rationale:
  [Tier 2] Moderate complexity routed to Llama 3.1 70B (local)

═══════════════════════════════════════════════════════════════

# Explain mode (shows alternative routing options)
npm run cli -- route "Design a distributed tracing system" --dry-run --explain

# Output includes alternatives:
Alternative Routes:
─────────────────────────────────────────────────────────────────

1. anthropic/claude-sonnet-4 (api)
   Cost: $0.0450, Latency: ~2.1s
   [Alternative] Claude Sonnet for higher quality

2. ollama/qwen3-coder-30b (local)
   Cost: $0.0000, Latency: ~2.5s
   [Tier 1] Default local (faster)

─────────────────────────────────────────────────────────────────

# Choose router strategy
npm run cli -- route "quantum circuit optimization" --router api-first
npm run cli -- route "simple task" --router simple

# Full execution example output:
Routing to: ollama / llama-3.1-70b
Rationale: [Tier 2] Moderate complexity routed to Llama 3.1 70B (local)

═══════════════════════════════════════════════════════════════
  Executing Inference
═══════════════════════════════════════════════════════════════

Response:
─────────────────────────────────────────────────────────────────

Here's a complete OAuth2 implementation in Python...
[response content]

─────────────────────────────────────────────────────────────────

Statistics:
  Model:             llama-3.1-70b
  Provider:          ollama
  Tokens (prompt):   125
  Tokens (response): 450
  Total tokens:      575
  Latency:           3.24s
  Finish reason:     completed
  Cost:              $0.00 (local)

═══════════════════════════════════════════════════════════════
```

## Configuration

The workbench supports YAML-based configuration files for persistent settings. This allows you to customize router behavior, provider settings, and default parameters without passing CLI flags every time.

### Creating a Configuration File

Copy the example configuration:

```bash
cp workbench.config.example.yaml workbench.config.yaml
```

Or create your own based on the template:

```yaml
# workbench.config.yaml
router:
  type: cost-aware  # Options: simple | cost-aware | api-first

  costAware:
    monthlyBudget: 100.00         # Monthly API budget limit
    defaultLocal: qwen3-coder-30b # Default local model
    complexityThreshold: 0.8      # Complexity threshold for API escalation
    tokenThreshold: 16000         # Token threshold for API escalation

providers:
  ollama:
    baseUrl: http://localhost:11434
    timeout: 120000  # 2 minutes

  anthropic:
    apiKey: ${ANTHROPIC_API_KEY}  # Expands from environment
    timeout: 120000

  openai:
    apiKey: ${OPENAI_API_KEY}
    timeout: 120000

defaults:
  temperature: 0.7    # Sampling temperature
  maxTokens: 4096     # Maximum tokens to generate
  stream: false       # Enable streaming by default
```

### Using Configuration Files

Pass the configuration file path via `--config`:

```bash
# Use custom configuration
npm run cli -- route "Write a parser" --config ./workbench.config.yaml

# Configuration settings are merged with CLI options (CLI takes precedence)
npm run cli -- route "Explain recursion" --config ./my-config.yaml --temperature 0.9
```

### Configuration Examples

#### Budget-Conscious Developer

Minimize API costs while maintaining quality:

```yaml
router:
  type: cost-aware
  costAware:
    monthlyBudget: 20.00
    complexityThreshold: 0.9  # Higher = more local usage
    tokenThreshold: 32000     # Only use API for very large contexts
defaults:
  temperature: 0.5
  maxTokens: 2048
```

#### Quality-First Team

Prioritize response quality over cost:

```yaml
router:
  type: api-first
  apiFirst:
    defaultModel: claude-opus-4
    defaultProvider: anthropic
    fallbackToLocal: true
defaults:
  temperature: 0.8
  maxTokens: 8192
  stream: true
```

#### Offline/Air-Gapped Environment

Only use local models:

```yaml
router:
  type: simple
  simple:
    defaultModel: llama-3.1-70b
    defaultProvider: ollama
providers:
  ollama:
    baseUrl: http://localhost:11434
defaults:
  temperature: 0.7
  maxTokens: 4096
```

### Environment Variable Expansion

Configuration files support `${ENV_VAR}` syntax for sensitive values:

```yaml
providers:
  anthropic:
    apiKey: ${ANTHROPIC_API_KEY}
  openai:
    apiKey: ${OPENAI_API_KEY}
    organization: ${OPENAI_ORG_ID}
```

Environment variables are expanded when loading the configuration:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
npm run cli -- route "Hello" --config ./workbench.config.yaml
```

## Programmatic API

### Complete Example

```typescript
import { CostAwareRouter } from './routers/cost-aware-router';
import { createGPUDetector } from './utils/gpu-factory';

async function main() {
  // 1. Initialize GPU detector
  const gpu = await createGPUDetector({ dockerAware: true });
  await gpu.initialize();

  const metrics = await gpu.getMetrics();
  console.log(`GPU: ${metrics.name} (${metrics.vramTotal.toFixed(1)} GiB)`);
  console.log(`VRAM Usage: ${metrics.vramUsagePercent.toFixed(1)}%`);

  // 2. Check if we have enough VRAM for local inference
  const hasEnoughVRAM = metrics.vramAvailable > 30; // 30+ GiB for Llama 70B

  // 3. Initialize cost-aware router
  const router = new CostAwareRouter({
    monthlyBudget: hasEnoughVRAM ? 50 : 200, // Lower budget if GPU available
    complexityThreshold: 0.8,
    tokenThreshold: 16000,
  });

  // 4. Route different types of requests
  const requests = [
    {
      prompt: 'Fix TypeScript errors in this file',
      estimatedTokens: 1500,
      complexity: 0.3,
    },
    {
      prompt: 'Design a microservices architecture for e-commerce',
      estimatedTokens: 8000,
      complexity: 0.7,
    },
    {
      prompt: 'Implement quantum error correction code',
      taskType: 'quantum',
      estimatedTokens: 3000,
    },
  ];

  for (const req of requests) {
    const decision = await router.route(req, { explain: true });

    console.log(`\nPrompt: ${req.prompt.substring(0, 60)}...`);
    console.log(`Decision: ${decision.target.provider}/${decision.target.model}`);
    console.log(`Cost: $${decision.estimatedCost.toFixed(4)}`);
    console.log(`Rationale: ${decision.rationale}`);

    if (decision.alternatives) {
      console.log(`Alternatives: ${decision.alternatives.length} other options`);
    }
  }

  // 5. Check budget status
  const spent = await router.getMonthlySpend();
  const remaining = await router.getRemainingBudget();
  console.log(`\nBudget: $${spent.toFixed(2)} spent, $${remaining.toFixed(2)} remaining`);
}

main().catch(console.error);
```

## Configuration

### Environment Variables

```bash
# GPU Provider Configuration
NVML_ENABLED=true
NVIDIA_SMI_PATH=/usr/bin/nvidia-smi

# Router Configuration
DEFAULT_ROUTER=cost-aware
MONTHLY_BUDGET=100

# API Keys (for production use)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

### YAML Configuration (Planned)

```yaml
# config/routing.yaml
routers:
  cost-aware:
    monthlyBudget: 100
    complexityThreshold: 0.8
    tokenThreshold: 16000
    defaultLocal: qwen3-coder-30b

  api-first:
    defaultProvider: anthropic
    defaultModel: claude-opus-4
    fallbackToLocal: true

gpu:
  providers:
    - nvml
    - nvidia-smi
    - simulated
  dockerAware: true
```

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm test -- simple-router.test.ts

# Watch mode for development
npm test -- --watch
```

**Current test coverage**: 102 tests passing, 78% coverage

## Development

### Project Structure

```
src/
├── commands/        # CLI command implementations
│   ├── gpu-info.ts  # GPU monitoring command
│   └── route.ts     # Routing command
├── core/            # Core abstractions
│   ├── gpu-provider.ts      # GPU provider interfaces
│   └── model-router.ts      # Router interfaces
├── providers/       # GPU provider implementations
│   ├── nvml-provider.ts         # Tier 1 (NVML bindings)
│   ├── nvidia-smi-provider.ts   # Tier 2 (CLI parsing)
│   └── simulated-gpu-provider.ts # Tier 3 (testing)
├── routers/         # Router implementations
│   ├── simple-router.ts      # Always local
│   ├── cost-aware-router.ts  # Budget-optimized
│   └── api-first-router.ts   # Quality-first
├── utils/           # Utilities
│   ├── cost-tracker.ts   # Persistent cost tracking
│   └── gpu-factory.ts    # GPU detector factory
└── index.ts         # Public API exports

docs/
└── adrs/            # Architecture Decision Records
    ├── ADR-001-security-hardening.md
    ├── ADR-002-routing-architecture.md
    └── ADR-003-gpu-abstraction.md
```

### Building

```bash
# Development build with watch mode
npm run dev

# Production build
npm run build

# Type checking only
npm run type-check

# Linting
npm run lint
```

### Creating Custom Routers

Extend `BaseModelRouter` to create your own routing strategy:

```typescript
import { BaseModelRouter, InferenceRequest, RouteDecision } from './core/model-router';

export class CustomRouter extends BaseModelRouter {
  readonly name = 'custom';

  async route(request: InferenceRequest): Promise<RouteDecision> {
    // Your custom routing logic here
    const tokens = request.estimatedTokens || 1000;

    if (request.prompt.includes('urgent')) {
      // Route urgent requests to fastest API
      const pricing = this.getModelPricing('anthropic', 'claude-sonnet-4');
      return this.createAPIDecision(
        'anthropic',
        'claude-sonnet-4',
        'Urgent request routed to fast API',
        tokens,
        pricing
      );
    }

    // Default to local
    return this.createLocalDecision(
      'ollama',
      'qwen3-coder-30b',
      'Default local routing',
      tokens
    );
  }
}
```

## Roadmap

### Completed ✅

- [x] Three-tier GPU provider abstraction (NVML → nvidia-smi → Simulated)
- [x] Docker/WSL environment detection and provider reordering
- [x] Three router implementations (Simple, CostAware, APIFirst)
- [x] 5-tier escalation workflow with budget enforcement
- [x] Persistent cost tracking with monthly aggregation
- [x] **Model provider implementations (Ollama, Anthropic, OpenAI)**
- [x] **Full inference execution with streaming support**
- [x] **Provider factory with environment variable configuration**
- [x] CLI commands (gpu-info, route) with dry-run/explain/watch/stream modes
- [x] **171 unit tests with 86.6% coverage**
- [x] TypeScript strict mode throughout
- [x] Pretty-printed CLI output with tables and formatting
- [x] **Comprehensive cost tracker tests**
- [x] **Budget status reporting after API calls**

### Future Enhancements

- [ ] YAML configuration loader
- [ ] Integration tests for end-to-end workflows

### Planned

- [ ] Security hardening checks (SELinux, firewall, ECC, TRR)
- [ ] Interactive remediation script generator
- [ ] `harden audit/generate/verify` CLI commands
- [ ] GitHub Actions CI/CD pipeline
- [ ] API documentation site
- [ ] Example routing configurations library
- [ ] Multi-GPU load balancing
- [ ] Request queuing and batching
- [ ] Prometheus metrics export
- [ ] Web dashboard for monitoring

## Contributing

See [Architecture Decision Records](docs/adrs/) for design rationale:

- **ADR-001**: Security hardening requirements and threat model
- **ADR-002**: Router architecture and plugin system design
- **ADR-003**: GPU abstraction three-tier fallback strategy

When contributing:

1. Follow TypeScript strict mode
2. Write unit tests for all new code (target 80%+ coverage)
3. Update ADRs for architectural changes
4. Use conventional commits (feat:, fix:, docs:, test:)

## License

MIT License - see [LICENSE](LICENSE) for details

## Acknowledgments

Built with:

- [TypeScript](https://www.typescriptlang.org/) - Type-safe development
- [Commander.js](https://github.com/tj/commander.js) - CLI framework
- [Jest](https://jestjs.io/) - Testing framework
- [node-nvidia-smi](https://github.com/iboshkov/node-nvidia-smi) - NVML bindings

Inspired by:

- [Ollama](https://ollama.ai/) - Local model serving
- [LiteLLM](https://github.com/BerriAI/litellm) - Unified API interface
- [vLLM](https://github.com/vllm-project/vllm) - High-performance inference

---

**Status**: Active development | **Version**: 0.1.0 | **Node**: >=18.0.0
