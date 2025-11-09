# ADR-001: Non-Privileged Execution and Audit-Only Security Model

## Status
Proposed

## Context

The RTX 5090 workstation hardening documentation specifies multiple system-level security controls:
- SELinux policy configuration
- 802.1X Network Access Control (NAC)
- MACsec tunnel setup
- Role-Based Access Control (RBAC)
- ZFS encrypted dataset configuration

These controls require root/administrator privileges to apply. This creates a critical decision point: should `hybrid-ai-workbench` auto-apply these configurations or provide auditing and guidance?

### Key Constraints
1. **Enterprise Security Requirements**: SOC2/ISO27001 compliance teams prohibit auto-configuration tools that modify system state without audit trails
2. **Deployment Friction**: Tools requiring root access face significant adoption barriers in corporate environments
3. **Catastrophic Failure Risk**: Misconfigured SELinux policies can lock users out of their systems
4. **Multi-Tenant Environments**: Users may not have root access on shared workstations
5. **Principle of Least Privilege**: Security tools should minimize their own attack surface

### Market Precedent Analysis
Successful security tooling follows the "audit and generate" pattern:

| Tool | Approach | Adoption |
|------|----------|----------|
| `kube-bench` | Generates remediation scripts, doesn't auto-apply | CIS Kubernetes benchmark standard |
| `lynis` | Audits system, outputs suggestions | 500K+ downloads, enterprise-trusted |
| `aws-vault` | Generates temporary credentials, doesn't modify IAM | De facto standard for AWS CLI |
| `terraform` | Generates execution plan for review before apply | Infrastructure-as-Code leader |

Tools that auto-modify without review (Chef in "push" mode, Puppet auto-run) face enterprise resistance.

## Decision

**`hybrid-ai-workbench` will operate in non-privileged mode with read-only auditing, generating executable Infrastructure-as-Code output.**

Specifically:
1. **No Root Required**: All commands run with user-level privileges
2. **Read-Only Inspection**: Audit current system state against hardening checklist
3. **Output-as-Code**: Generate shell scripts, Ansible playbooks, and Terraform modules
4. **Diff-Based Reporting**: Show current vs. recommended configuration with color-coded output
5. **Dry-Run First**: All commands default to simulation mode unless `--apply` flag is passed (reserved for non-privileged operations like model downloads)

### Command Design Pattern

```bash
# Audit mode (default, no privileges required)
$ hybrid-ai-workbench harden audit
[FAIL] SELinux: nvidia-uvm module not restricted
[FAIL] Network: 802.1X NAC not configured on eth0
[PASS] GPU: ECC memory enabled
[WARN] Firewall: 12 non-standard ports open

Generate remediation: hybrid-ai-workbench harden generate --format=bash

# Generate executable remediation
$ hybrid-ai-workbench harden generate --format=bash > apply-hardening.sh
$ hybrid-ai-workbench harden generate --format=ansible > playbook.yml
$ hybrid-ai-workbench harden generate --format=terraform > main.tf

# User reviews, then applies with full audit trail
$ sudo bash apply-hardening.sh
$ git add apply-hardening.sh && git commit -m "chore: apply RTX 5090 hardening"
```

## Rationale

### Why This Approach Wins

1. **Enterprise Adoption**: Security teams can review generated configs before application, satisfying audit requirements
2. **Version Control Integration**: Generated scripts commit to git, providing full provenance of security changes
3. **Reduced Support Burden**: Tool can't brick systems by misconfiguring SELinux
4. **Flexible Deployment**: Output can be integrated into existing IaC pipelines (Ansible, Terraform, SaltStack)
5. **Educational Value**: Users learn what changes are needed rather than trusting a black box
6. **CI/CD Friendly**: Can run in GitHub Actions to detect configuration drift without requiring secrets

### Alignment with Whitepaper Principles

The original RTX 5090 documentation emphasizes:
> "These proactive security measures form the foundation for a secure system"

By generating verified, reviewable configs, we:
- Maintain the **proactive** nature (detect issues before exploitation)
- Add **transparency** (all changes are visible and auditable)
- Enable **incremental hardening** (apply controls gradually, test between changes)

## Consequences

### Positive
- ✅ No privileged access required → lower barrier to adoption
- ✅ Generated configs are portable across environments
- ✅ Integrates with existing enterprise IaC tooling
- ✅ Provides education pathway (users see what "good" looks like)
- ✅ Enables automated compliance reporting in CI/CD
- ✅ Tool can be distributed via npm without security review friction

### Negative
- ❌ Loses "one-click hardening" simplicity
- ❌ Users must manually execute generated scripts
- ❌ Two-step process (generate → apply) vs one-step (auto-apply)
- ❌ Must maintain multiple output formats (bash, Ansible, Terraform)
- ❌ Validation logic doesn't guarantee successful application

### Mitigations for Negative Consequences

1. **Interactive Mode**: Offer `--interactive` flag that explains each step
   ```bash
   $ hybrid-ai-workbench harden audit --interactive
   [FAIL] SELinux: nvidia-uvm module not restricted

   Why this matters:
   Unrestricted GPU access allows any process to allocate VRAM,
   enabling potential data exfiltration or crypto-mining attacks.

   Recommended fix:
   semanage fcontext -a -t nvidia_device_t "/dev/nvidia-uvm"

   Apply now? [y/N]
   ```

2. **Format Prioritization**: Start with bash-only, add Ansible/Terraform in Phase 2 based on user demand

3. **Validation Post-Apply**: Provide `harden verify` command to confirm changes took effect
   ```bash
   $ sudo bash apply-hardening.sh
   $ hybrid-ai-workbench harden verify
   ✓ All 8 hardening controls successfully applied
   ```

## Alternatives Considered

### Alternative 1: Auto-Apply with Root Elevation
**Approach**: Request sudo password, auto-apply all hardening controls

**Rejected Because**:
- Users rightly distrust npm packages requesting root access
- Catastrophic failure modes (SELinux misconfiguration can require rescue mode)
- Enterprise security policies prohibit this pattern

### Alternative 2: Daemon Mode with Privilege Separation
**Approach**: Run privileged daemon, user-level CLI communicates via socket

**Rejected Because**:
- Adds deployment complexity (systemd service, permission management)
- Larger attack surface (long-lived privileged process)
- Overkill for a workstation tool (more appropriate for server infrastructure)

### Alternative 3: Hybrid Approach (Auto-Apply Non-Destructive Only)
**Approach**: Auto-apply safe changes (download models), require manual apply for system configs

**Deferred**: This is actually a reasonable evolution for Phase 2
- Could auto-apply: Model downloads, benchmark runs, VRAM monitoring
- Require review: SELinux policies, firewall rules, network configs
- Decision: Start with strict audit-only, relax based on user feedback

## Implementation Notes

### Phase 1 Scope (MVP)
- Bash script generation only
- Support for 5 critical hardening controls:
  1. SELinux GPU access restrictions
  2. Firewall configuration (allow only necessary ports)
  3. ECC memory validation
  4. TRR DRAM detection
  5. NVML monitoring setup

### Detection Logic Requirements
```typescript
// Example: SELinux audit implementation
interface HardeningCheck {
  id: string;
  category: 'gpu' | 'network' | 'system' | 'data';
  severity: 'critical' | 'high' | 'medium' | 'low';
  detect(): Promise<CheckResult>;
  remediate(): string; // Returns bash script
}

class SELinuxGPUCheck implements HardeningCheck {
  async detect(): Promise<CheckResult> {
    // Read-only: Check if nvidia-uvm has correct SELinux context
    const context = await execRead('ls -Z /dev/nvidia-uvm');
    const isRestricted = context.includes('nvidia_device_t');

    return {
      passed: isRestricted,
      current: context,
      expected: 'nvidia_device_t',
      impact: 'Unrestricted GPU access enables VRAM data exfiltration'
    };
  }

  remediate(): string {
    return `semanage fcontext -a -t nvidia_device_t "/dev/nvidia-uvm"\nrestorecon -v /dev/nvidia-uvm`;
  }
}
```

### Success Metrics
- ✅ Tool can detect configuration drift in <5 seconds
- ✅ Generated scripts are idempotent (safe to run multiple times)
- ✅ 100% of generated commands include explanatory comments
- ✅ Zero sudo/root commands in the CLI tool itself

## References
- Original RTX 5090 hardening documentation: `/RTX 5090 AI & Quantum Workstation Deployment.txt`
- CIS Benchmark methodology: https://www.cisecurity.org/cis-benchmarks
- kube-bench source code: https://github.com/aquasecurity/kube-bench
- Terraform apply workflow: https://www.terraform.io/docs/cli/run/index.html

## Related ADRs
- ADR-002: Model-Router Architecture (decision on privileged vs non-privileged routing)
- ADR-003: GPU Abstraction Layer (NVML access permissions)

---

**Decision Date**: 2025-11-09
**Status**: Awaiting review and approval before implementation
