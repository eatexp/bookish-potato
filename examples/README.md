# Configuration Examples

This directory contains example configurations for different use cases of the Hybrid AI Workbench.

## Available Examples

- **`budget-conscious.yaml`** - Minimizes API costs while maintaining quality
- **`quality-first.yaml`** - Prioritizes response quality over cost
- **`offline.yaml`** - Air-gapped/offline environment (local-only)
- **`development.yaml`** - Development environment with simulated GPU
- **`production.yaml`** - Production-ready configuration with monitoring

## Usage

Copy an example configuration and customize it:

```bash
# Copy example
cp examples/budget-conscious.yaml workbench.config.yaml

# Edit configuration
nano workbench.config.yaml

# Set environment variables
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."

# Use configuration
npm run cli -- route "Your prompt" --config ./workbench.config.yaml
```

## Environment Variables

All examples support environment variable expansion using `${VARIABLE_NAME}` syntax:

```yaml
providers:
  anthropic:
    apiKey: ${ANTHROPIC_API_KEY}  # Expands from environment
  openai:
    apiKey: ${OPENAI_API_KEY}
    organization: ${OPENAI_ORG_ID}
```

Required environment variables:
- `ANTHROPIC_API_KEY` - Anthropic API key (for cloud routing)
- `OPENAI_API_KEY` - OpenAI API key (for cloud routing)
- `OPENAI_ORG_ID` - OpenAI organization ID (optional)

## Customization Tips

### Adjusting Budget

```yaml
router:
  costAware:
    monthlyBudget: 50.00  # Increase or decrease as needed
```

### Changing Default Models

```yaml
router:
  costAware:
    defaultLocal: llama-3.1-70b  # Change local model
```

### Tuning Escalation Thresholds

```yaml
router:
  costAware:
    complexityThreshold: 0.9  # Higher = more local usage
    tokenThreshold: 32000     # Only use API for very large contexts
```

### Provider Timeouts

```yaml
providers:
  ollama:
    timeout: 300000  # 5 minutes for large models
  anthropic:
    timeout: 60000   # 1 minute for faster APIs
```

## Testing Configurations

Test your configuration with dry-run mode:

```bash
npm run cli -- route "Test prompt" \
  --config ./workbench.config.yaml \
  --dry-run \
  --explain
```

This shows the routing decision without actually executing the request.
