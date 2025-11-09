# Architecture Decision Records (ADRs)

This directory contains the architectural decisions for `hybrid-ai-workbench`, documenting the rationale behind key design choices before implementation begins.

## Index

| ADR | Title | Status | Impact |
|-----|-------|--------|--------|
| [001](./001-security-model-non-privileged-execution.md) | Non-Privileged Execution and Audit-Only Security Model | Proposed | High - Determines tool's security posture and deployment model |
| [002](./002-plugin-based-model-router-architecture.md) | Plugin-Based Model Router Architecture | Proposed | High - Core differentiator, determines extensibility |
| [003](./003-gpu-abstraction-layer-nvml-graceful-degradation.md) | GPU Abstraction Layer with NVML and Graceful Degradation | Proposed | Medium - Enables cross-platform support and testing |

## Cross-ADR Dependency Analysis

### ADR-001 → ADR-003: Security Model Impacts GPU Access

**Dependency**: ADR-001's non-privileged execution requirement constrains ADR-003's GPU detection approach.

| Scenario | ADR-001 Requirement | ADR-003 Implementation | ✓/✗ |
|----------|---------------------|------------------------|-----|
| NVML access | No root required | NVML reads from `/dev/nvidia*` (world-readable) | ✓ |
| nvidia-smi parsing | No root required | nvidia-smi available to all users | ✓ |
| Docker GPU access | No privileged containers | Works with `--gpus all` (non-privileged) | ✓ |

**Conclusion**: ✅ No conflicts. ADR-003's three-tier approach aligns with ADR-001's constraints.

### ADR-002 → ADR-003: Router Depends on GPU Metrics

**Dependency**: ADR-002's model router requires VRAM metrics from ADR-003.

```typescript
// Example: Router decision requires GPU metrics
class CostAwareRouter {
  async route(request: InferenceRequest): Promise<RouteDecision> {
    const gpu = await gpuDetector.getMetrics(); // From ADR-003

    // Decision logic from ADR-002
    if (request.model === 'llama-3.1-70b' && gpu.vramTotal < 40) {
      return this.escalateToAPI('Insufficient VRAM');
    }
    // ...
  }
}
```

**Critical Requirement**: Router must handle all three GPU provider tiers gracefully.

| Tier | VRAM Metrics | Router Behavior | ✓/✗ |
|------|--------------|-----------------|-----|
| NVML | Real-time, accurate | Optimal routing decisions | ✓ |
| nvidia-smi | Real-time, accurate | Optimal routing decisions | ✓ |
| Simulated | Static, fake | **Risk**: May recommend models that don't fit actual GPU | ⚠️ |

**Mitigation**: When using simulated metrics, router should:
1. Log warning: "Using simulated GPU metrics - routing decisions may be inaccurate"
2. Provide `--override-vram` flag for users to specify actual capacity
3. Default to conservative routing (prefer local models that fit on any RTX GPU)

**Conclusion**: ✓ Compatible with mitigation. ADR-002 router will handle degraded metrics from ADR-003.

### ADR-001 → ADR-002: Security Constraints on Routing

**Dependency**: ADR-001's audit-only approach affects ADR-002's cost tracking.

**Scenario**: Cost-aware router needs to track monthly API spend to make routing decisions.

| Data Source | Requires Privileged Access? | ADR-001 Compatible? |
|-------------|----------------------------|---------------------|
| Local JSON file in user's home directory | No | ✓ Yes |
| System-wide tracking in `/var/lib/` | Yes (multi-user environments) | ✗ No |
| Cloud API billing dashboard | No (API key only) | ✓ Yes |

**Implementation**:
```typescript
// Store cost tracking in user-writable location
const costTracker = new CostTracker({
  storageLocation: path.join(os.homedir(), '.config/hybrid-ai-workbench/costs.json')
});
```

**Conclusion**: ✅ No conflicts. Cost tracking uses non-privileged user storage.

## Unified Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      User Interface (CLI)                    │
│                  $ hybrid-ai-workbench                       │
└────────────────┬────────────────────────────────────────────┘
                 │
    ┌────────────┴────────────┬─────────────────┐
    │                         │                 │
    v                         v                 v
┌─────────────────┐  ┌──────────────────┐  ┌──────────────┐
│ Harden Command  │  │  Route Command   │  │  GPU Command │
│   (ADR-001)     │  │    (ADR-002)     │  │  (ADR-003)   │
└────────┬────────┘  └────────┬─────────┘  └──────┬───────┘
         │                    │                    │
         │                    │                    │
         v                    v                    v
┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Security Auditor│  │  Model Router    │  │  GPU Detector    │
│                 │  │  (Plugin-based)  │  │  (3-tier)        │
│ - Read-only     │  │                  │  │                  │
│ - Generates     │  │ ┌──────────────┐ │  │ ┌──────────────┐ │
│   bash/Ansible  │  │ │ Cost-Aware   │ │  │ │ NVML (Tier 1)│ │
│                 │  │ │ Router       │ │  │ └──────┬───────┘ │
│ ┌─────────────┐ │  │ └──────────────┘ │  │        │         │
│ │ SELinux     │ │  │                  │  │        v         │
│ │ Firewall    │ │  │ ┌──────────────┐ │  │ ┌──────────────┐ │
│ │ ECC Check   │ │  │ │ HIPAA Router │ │  │ │nvidia-smi(2) │ │
│ └─────────────┘ │  │ └──────────────┘ │  │ └──────┬───────┘ │
└─────────────────┘  └────────┬─────────┘  │        │         │
                              │             │        v         │
                              │             │ ┌──────────────┐ │
                              │             │ │Simulated (3) │ │
                              │             │ └──────────────┘ │
                              │             └──────────────────┘
                              │
                              v
                    ┌─────────────────────┐
                    │  Execution Layer    │
                    ├─────────────────────┤
                    │ - Ollama (local)    │
                    │ - Anthropic API     │
                    │ - OpenAI API        │
                    └─────────────────────┘
```

## Identified Gaps and Future ADRs

### Gap 1: Cost Tracking Persistence
**Issue**: ADR-002 mentions cost tracking, but doesn't specify:
- Storage format (JSON, SQLite, encrypted?)
- Sync between multiple machines
- Historical data retention policy

**Recommendation**: Defer to Phase 2, document in separate ADR when usage patterns emerge.

### Gap 2: Configuration Management
**Issue**: Multiple ADRs reference configuration (routing.yml, model preferences), but no unified config strategy.

**Recommendation**: Add ADR-004 for configuration hierarchy:
1. Default config (built into binary)
2. System-wide config (`/etc/hybrid-ai-workbench/`)
3. User config (`~/.config/hybrid-ai-workbench/`)
4. Project config (`./.hybrid-ai-workbench/`)
5. Environment variables
6. CLI flags

### Gap 3: Telemetry and Privacy
**Issue**: ADRs mention "telemetry opt-in" for measuring provider distribution, but no privacy policy.

**Recommendation**: Add ADR-005 before any telemetry implementation, addressing:
- What data is collected (provider type, command usage)
- What is NOT collected (prompts, API keys, model outputs)
- Opt-in/opt-out mechanism
- GDPR compliance (right to deletion)

## Risk Summary

| Risk | Severity | Mitigation | Owner |
|------|----------|------------|-------|
| NVML bindings fail to compile on Windows | High | Fallback to nvidia-smi works | ADR-003 |
| Simulated metrics mislead router decisions | Medium | Conservative routing + warnings | ADR-002 + ADR-003 |
| Users expect auto-apply hardening | Medium | Clear documentation, interactive mode | ADR-001 |
| Plugin API breaking changes | Low | Semver guarantees, stability period | ADR-002 |

## Implementation Sequence

Based on dependency analysis, recommended build order:

1. **Week 1-2**: ADR-003 (GPU Abstraction Layer)
   - Implements foundational capability
   - No dependencies on other ADRs
   - PoC validates technical risk (NVML bindings)

2. **Week 3-4**: ADR-002 (Model Router)
   - Depends on ADR-003 for VRAM metrics
   - Core differentiator - critical to get right
   - Plugin architecture takes time to stabilize

3. **Week 5-6**: ADR-001 (Security Auditor)
   - Independent implementation (can parallelize with ADR-002)
   - Lower technical risk (bash generation)
   - Completes the "hybrid workbench" vision

## Approval Process

Each ADR requires:
1. ✅ Technical review (consistency check - DONE)
2. ⏳ Stakeholder approval (awaiting user confirmation)
3. ⏳ Prototype validation (PoC for ADR-003)

**Status**: Ready for stakeholder approval to proceed with implementation.

---

**Last Updated**: 2025-11-09
**Next Review**: After PoC completion (Week 2)
