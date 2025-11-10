# Contributing to Hybrid AI Workbench

Thank you for your interest in contributing! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing Requirements](#testing-requirements)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Architecture Guidelines](#architecture-guidelines)

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help maintain a welcoming environment
- Report any unacceptable behavior to maintainers

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- TypeScript knowledge
- Git

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR-USERNAME/bookish-potato.git
   cd bookish-potato
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Create a feature branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```

5. Verify everything works:
   ```bash
   npm test
   npm run lint
   npm run build
   ```

## Development Workflow

### Running in Development Mode

```bash
# Watch mode for automatic rebuilds
npm run dev

# Run specific command during development
npm run cli -- gpu-info
npm run cli -- route "test prompt" --dry-run
```

### Testing Changes

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- simple-router.test.ts

# Watch mode for TDD
npm test -- --watch
```

### Type Checking

```bash
# Full type check
npm run type-check

# Lint code
npm run lint

# Auto-fix lint issues
npm run lint -- --fix
```

## Code Standards

### TypeScript Guidelines

1. **Strict Mode**: All code must pass TypeScript strict mode checks
   ```typescript
   // Good
   function processData(data: string): number {
     return parseInt(data, 10);
   }

   // Bad - implicit any
   function processData(data) {
     return parseInt(data, 10);
   }
   ```

2. **Explicit Return Types**: Always specify return types for functions
   ```typescript
   // Good
   async function fetchData(): Promise<User> {
     // ...
   }

   // Bad - inferred return type
   async function fetchData() {
     // ...
   }
   ```

3. **No `any` Types**: Avoid `any` types; use `unknown` or proper types
   ```typescript
   // Good
   function parseJSON(json: string): unknown {
     return JSON.parse(json);
   }

   // Bad
   function parseJSON(json: string): any {
     return JSON.parse(json);
   }
   ```

4. **Interface Over Type**: Prefer interfaces for object shapes
   ```typescript
   // Good
   interface RouterConfig {
     monthlyBudget: number;
     defaultModel: string;
   }

   // Acceptable for unions/primitives
   type RouterType = 'simple' | 'cost-aware' | 'api-first';
   ```

### Code Style

- **Indentation**: 2 spaces (configured in `.editorconfig`)
- **Line Length**: 100 characters maximum
- **Quotes**: Single quotes for strings
- **Semicolons**: Required
- **Trailing Commas**: Required in multiline structures
- **Naming Conventions**:
  - Classes: PascalCase (`CostAwareRouter`)
  - Interfaces: PascalCase (`InferenceRequest`)
  - Functions: camelCase (`createProvider`)
  - Constants: UPPER_SNAKE_CASE (`MAX_RETRIES`)
  - Files: kebab-case (`cost-aware-router.ts`)

### Documentation

1. **JSDoc for Public APIs**:
   ```typescript
   /**
    * Route an inference request to the optimal provider
    * @param request - The inference request with prompt and metadata
    * @param options - Optional routing options (force model, explain mode, etc.)
    * @returns Route decision with target provider and cost estimate
    */
   async route(request: InferenceRequest, options?: RoutingOptions): Promise<RouteDecision> {
     // ...
   }
   ```

2. **Inline Comments**: Explain "why", not "what"
   ```typescript
   // Good
   // Skip NVML in Docker due to library incompatibility with container runtime
   if (isDockerEnvironment) {
     providers = providers.filter(p => p.name !== 'NVML');
   }

   // Bad
   // Filter providers
   if (isDockerEnvironment) {
     providers = providers.filter(p => p.name !== 'NVML');
   }
   ```

## Testing Requirements

### Coverage Requirements

- **Minimum Coverage**: 80% for all code
- **Critical Paths**: 100% for routing logic and cost tracking
- **Integration Tests**: Required for all major workflows

### Test Structure

```typescript
describe('CostAwareRouter', () => {
  describe('route()', () => {
    it('should route simple tasks to local models', async () => {
      const router = new CostAwareRouter({ monthlyBudget: 100 });
      const decision = await router.route({
        prompt: 'Simple task',
        estimatedTokens: 500,
        complexity: 0.2,
      });

      expect(decision.target.type).toBe('local');
      expect(decision.target.model).toBe('qwen3-coder-30b');
    });

    it('should escalate high complexity to GPT-5', async () => {
      const router = new CostAwareRouter({ monthlyBudget: 100 });
      const decision = await router.route({
        prompt: 'Complex reasoning task',
        estimatedTokens: 2000,
        complexity: 0.95,
      });

      expect(decision.target.type).toBe('api');
      expect(decision.target.model).toBe('gpt-5');
    });
  });
});
```

### Test File Naming

- Unit tests: `*.test.ts` in `tests/unit/`
- Integration tests: `*-workflow.test.ts` in `tests/integration/`
- Test fixtures: `tests/fixtures/`

### Mocking Guidelines

- Mock external dependencies (API calls, file I/O)
- Don't mock internal modules unless testing integration
- Use Jest's built-in mocking when possible

## Commit Message Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Adding or updating tests
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `chore`: Build process or auxiliary tool changes
- `ci`: CI/CD changes

### Examples

```
feat(router): add budget override option for cost-aware routing

Add a budgetOverride parameter to CostAwareRouter.route() that allows
temporary budget increases for specific requests without changing the
monthly budget configuration.

Closes #123
```

```
fix(gpu): correct VRAM calculation for multi-GPU systems

The previous implementation only summed total VRAM but didn't account
for per-GPU usage differences in multi-GPU setups. Now properly reports
aggregate and per-device metrics.

Fixes #456
```

## Pull Request Process

### Before Submitting

1. **Run Full Test Suite**:
   ```bash
   npm test
   npm run lint
   npm run build
   ```

2. **Update Documentation**:
   - Update README.md if adding features
   - Add JSDoc comments to public APIs
   - Update CHANGELOG.md

3. **Create/Update Tests**:
   - Unit tests for new components
   - Integration tests for new workflows
   - Maintain 80%+ coverage

4. **Update ADRs** (if changing architecture):
   - Document major architectural decisions
   - Follow ADR template in `docs/adrs/`

### PR Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that breaks existing functionality)
- [ ] Documentation update

## Testing

- [ ] Unit tests pass (npm test)
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Code coverage maintained/improved

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings
- [ ] Tests added/updated
```

### Review Process

1. Maintainers will review within 3-5 business days
2. Address review feedback in new commits
3. Once approved, squash and merge
4. Delete feature branch after merge

## Architecture Guidelines

### Adding New Routers

1. Extend `BaseModelRouter`:
   ```typescript
   export class MyRouter extends BaseModelRouter {
     readonly name = 'my-router';

     async route(request: InferenceRequest): Promise<RouteDecision> {
       // Implementation
     }
   }
   ```

2. Add to router factory in `utils/router-factory.ts`
3. Add tests in `tests/unit/routers/`
4. Document in README.md

### Adding New Providers

1. Implement `ModelProvider` or `GPUProvider` interface
2. Add to factory (`utils/provider-factory.ts` or `utils/gpu-factory.ts`)
3. Add comprehensive tests
4. Update documentation

### Architecture Decision Records

For significant architectural changes, create an ADR in `docs/adrs/`:

```markdown
# ADR-004: Title

## Status

Proposed | Accepted | Deprecated | Superseded

## Context

What is the issue we're trying to solve?

## Decision

What is the change we're making?

## Consequences

What are the pros and cons of this decision?
```

## Getting Help

- **Questions**: Open a GitHub Discussion
- **Bugs**: Open an Issue with reproduction steps
- **Security**: Email security@example.com (do not open public issues)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
