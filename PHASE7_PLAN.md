# Phase 7 Plan: Branch Coverage and Final Coverage Push

**Goal:** Achieve 97%+ line coverage and 92%+ branch coverage through targeted testing

**Current Status:**
- Line Coverage: 95.98%
- Branch Coverage: 89.11% ⚠️
- Function Coverage: 99.07%
- Tests: 403

**Target:**
- Line Coverage: 97%+ (+1.02%)
- Branch Coverage: 92%+ (+2.89%)
- Function Coverage: Maintain 99%+
- Tests: 420-440 (+17-37 tests)

---

## 📊 Coverage Gap Analysis

### Priority 1: Branch Coverage Gaps (Critical)

#### 1. **core/model-router.ts** - 55.55% branches ⚠️ HIGH PRIORITY
**Current:** 95% lines, 55.55% branches, 100% functions
**Target:** 95%+ lines, 85%+ branches

**Uncovered:**
- Line 113: `return 0;` for local models (actually covered, but branch tracking issue)
- Multiple conditional branches in estimateCost, estimateLatency, getModelPricing

**Tests Needed:**
- Test estimateCost() with API target (cover line 117-123)
- Test estimateLatency() with API target (cover line 136-137)
- Test getModelPricing() with unknown model (cover line 237-241 fallback)
- Test createLocalDecision() with custom pricing parameter
- Test createAPIDecision() with various models
- Test all branches in conditional logic

**Estimated Impact:** +30% branch coverage on this file

---

### Priority 2: Uncovered Lines in Well-Tested Modules

#### 2. **utils/config-loader.ts** - 90.9% coverage
**Uncovered Lines:** 66, 71, 126, 136, 139, 177

**Error Paths:**
- Line 66: Non-Error exception in YAML parsing
- Line 71: Invalid config object (null or not object)
- Line 126: Invalid simple.defaultProvider type
- Line 136: Invalid apiFirst.defaultModel type
- Line 139: Invalid apiFirst.defaultProvider type
- Line 177: Early return in expandEnvVars for non-object

**Tests Needed:**
- Test YAML parse error with non-Error exception (throw string)
- Test invalid config (null, array, string instead of object)
- Test simple router with invalid defaultProvider type
- Test apiFirst router with invalid defaultModel type
- Test apiFirst router with invalid defaultProvider type
- Test expandEnvVars with primitive values

**Estimated Impact:** +6% on config-loader

---

#### 3. **providers/nvml-provider.ts** - 90.9% coverage
**Uncovered Lines:** 96, 121, 179, 184, 200, 217, 233

**Error Paths:**
- Line 96: isAvailable() returns false when NVML unavailable
- Line 121: Unknown error type in getMetrics()
- Line 179: Missing memory value (undefined)
- Line 184: Invalid memory format
- Line 200: Invalid percentage format (return undefined)
- Line 217: Invalid numeric string format (return undefined)
- Line 233: Invalid PCIe width format (return undefined)

**Tests Needed:**
- Test isAvailable() when nvidia-smi throws error
- Test getMetrics() with non-Error exception
- Test parseMemoryString() with undefined input
- Test parseMemoryString() with invalid format ("invalid", "123")
- Test parsePercentageString() with invalid format ("invalid", "abc%")
- Test parseNumericString() with invalid format ("invalid W", "abc C")
- Test parsePCIeWidth() with invalid format ("invalid", "x")

**Estimated Impact:** +9% on nvml-provider

---

### Priority 3: Provider Uncovered Lines

#### 4. **providers/openai-provider.ts** - 93.89% coverage
**Uncovered Lines:** 136, 147, 293, 320, 346, 378, 397, 408

**Analysis Required:**
- Need to read file and identify these specific lines
- Likely stream handling, error paths, or edge cases

**Estimated Impact:** +6% on openai-provider

---

#### 5. **providers/anthropic-provider.ts** - 97.02% coverage
**Uncovered Lines:** 145, 296, 338

**High coverage already, just a few edge cases**

**Estimated Impact:** +3% on anthropic-provider

---

#### 6. **providers/simulated-gpu-provider.ts** - 92.59% coverage
**Uncovered Lines:** 41, 44

**Estimated Impact:** +7% on simulated-gpu-provider

---

### Priority 4: Minor Gaps

#### 7. **routers/cost-aware-router.ts** - 98.33% coverage
**Uncovered Line:** 147

Already excellent, minimal effort needed

---

#### 8. **utils/cost-tracker.ts** - 97.05% coverage
**Uncovered Lines:** 171, 198

Already excellent, minimal effort needed

---

## 📋 Implementation Strategy

### Phase 7A: Branch Coverage Focus (Highest ROI)
**Target Files:** model-router.ts, config-loader.ts
**Estimated Tests:** 12-15 tests
**Expected Impact:** Line +0.3%, Branch +2.5%
**Time:** 30-45 minutes

**Test Suite:** `tests/unit/core/model-router-branch-coverage.test.ts`
- BaseModelRouter estimateCost() API path
- BaseModelRouter estimateLatency() API path
- BaseModelRouter getModelPricing() unknown model fallback
- BaseModelRouter createLocalDecision() with custom pricing
- BaseModelRouter createAPIDecision() variations

**Test Suite:** `tests/unit/utils/config-loader-coverage.test.ts`
- YAML parse with non-Error exception
- Invalid config types (null, array, string)
- Simple router config validation errors
- APIFirst router config validation errors
- expandEnvVars with primitive values

---

### Phase 7B: NVML Provider Error Paths
**Target Files:** nvml-provider.ts
**Estimated Tests:** 7-8 tests
**Expected Impact:** Line +0.4%, Branch +0.3%
**Time:** 20-30 minutes

**Test Suite:** `tests/unit/providers/nvml-coverage.test.ts`
- isAvailable() NVML unavailable scenario
- getMetrics() non-Error exception
- parseMemoryString() error paths
- parsePercentageString() invalid formats
- parseNumericString() invalid formats
- parsePCIeWidth() invalid formats

---

### Phase 7C: Remaining Provider Gaps
**Target Files:** openai-provider.ts, anthropic-provider.ts, simulated-gpu-provider.ts
**Estimated Tests:** 8-10 tests
**Expected Impact:** Line +0.5%, Branch +0.2%
**Time:** 30-40 minutes

**Requires:** Reading files to identify specific uncovered lines

---

### Phase 7D: Final Touches
**Target Files:** cost-aware-router.ts, cost-tracker.ts
**Estimated Tests:** 3-4 tests
**Expected Impact:** Line +0.1%
**Time:** 10-15 minutes

---

## 🎯 Success Metrics

### Minimum Goals
- ✅ Line Coverage: 97.0% (+1.02%)
- ✅ Branch Coverage: 92.0% (+2.89%)
- ✅ Function Coverage: 99%+ (maintain)
- ✅ All tests passing (420+ tests)

### Stretch Goals
- 🎯 Line Coverage: 97.5% (+1.52%)
- 🎯 Branch Coverage: 93.0% (+3.89%)
- 🎯 model-router.ts branch coverage: 85%+ (from 55.55%)
- 🎯 All modules 95%+ line coverage

---

## 📦 Expected Deliverables

1. **Test Files:**
   - `tests/unit/core/model-router-branch-coverage.test.ts` (~12 tests)
   - `tests/unit/utils/config-loader-coverage.test.ts` (~8 tests)
   - `tests/unit/providers/nvml-coverage.test.ts` (~7 tests)
   - `tests/unit/providers/openai-coverage.test.ts` (~6 tests)
   - `tests/unit/providers/misc-coverage.test.ts` (~5 tests)

2. **Documentation:**
   - Updated SESSION_SUMMARY.md with Phase 7
   - Coverage analysis report

3. **Git Commits:**
   - 2-3 atomic commits for test suites
   - 1 commit for documentation

---

## 🚀 Recommended Approach

**Start with Phase 7A** - Highest impact on branch coverage:
1. Create model-router-branch-coverage.test.ts
2. Create config-loader-coverage.test.ts
3. Run coverage and verify improvement
4. Commit Phase 7A

**Then Phase 7B** - NVML provider error paths:
1. Create nvml-coverage.test.ts
2. Run coverage and verify improvement
3. Commit Phase 7B

**Then Phase 7C** - Remaining providers if time permits

**Time Estimate:** 1.5-2 hours for Phases 7A+7B to reach 97%+ line coverage

---

## 📝 Notes

- Focus on **meaningful tests** that verify actual behavior, not just coverage metrics
- All tests should validate **edge cases and error handling**
- Maintain test quality standards from previous phases
- Document test intentions clearly
- Verify all tests pass before committing
