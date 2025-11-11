# Phase 6 Planning: Strategic Coverage Improvements

**Current State:** 95.48% coverage, 386 tests, 22 suites
**Target:** 96-97% coverage with high-value strategic tests

---

## Coverage Analysis by Module

### 🎯 High-Priority Targets (Strategic Value)

#### 1. **model-router.ts** (Core Routing Logic)
- **Current:** 95% lines, **55.55% branches** ⚠️
- **Uncovered:** Line 113
- **Impact:** HIGH - Core routing decisions affect entire system
- **Recommendation:** Add tests for all routing decision branches
- **Estimated Tests:** 3-5 tests

#### 2. **cost-aware-router.ts** (Budget Management)
- **Current:** 91.66% lines, **83.33% functions**
- **Uncovered:** Lines 110, 119, 147, 244-245
- **Impact:** HIGH - Budget calculations critical for cost control
- **Recommendation:** Test uncovered helper function and edge cases
- **Estimated Tests:** 4-6 tests

#### 3. **openai-provider.ts** (API Integration)
- **Current:** 94.02% lines, **83.33% branches**
- **Uncovered:** Lines 136, 147, 293, 320, 346, 378, 397, 408
- **Impact:** MEDIUM - API provider robustness
- **Recommendation:** Test organization header paths, error branches
- **Estimated Tests:** 3-4 tests

### 📊 Medium-Priority Targets

#### 4. **nvml-provider.ts** (GPU Metrics)
- **Current:** 90.9% lines
- **Uncovered:** Lines 96, 121, 179, 184, 200, 217, 233
- **Impact:** MEDIUM - GPU metrics fallback paths
- **Recommendation:** Test error conditions and missing data scenarios
- **Estimated Tests:** 4-5 tests

#### 5. **config-loader.ts** (Configuration)
- **Current:** 90.9% lines
- **Uncovered:** Lines 66, 71, 126, 136, 139, 177
- **Impact:** MEDIUM - Config validation edge cases
- **Recommendation:** Test edge cases in validation logic
- **Estimated Tests:** 3-4 tests

### ✅ Low-Priority / Acceptable Coverage

#### 6. **anthropic-provider.ts** - 97.02% ✓
#### 7. **ollama-provider.ts** - 98.92% ✓
#### 8. **cost-tracker.ts** - 97.18% ✓
#### 9. **simulated-gpu-provider.ts** - 92.59% ✓

---

## Recommended Implementation Strategy

### **Phase 6A: Core Routing Tests** (Highest ROI)
**Priority:** CRITICAL
**Target:** model-router.ts and cost-aware-router.ts
**Estimated Coverage Gain:** +1.5-2%

Tests to add:
1. **model-router.ts edge cases:**
   - Router with missing config
   - Routing decisions with null/undefined values
   - Branch coverage for all decision paths

2. **cost-aware-router.ts uncovered function:**
   - Test the uncovered helper function (line 244-245)
   - Budget boundary conditions (line 110, 119)
   - Alternative routing paths (line 147)

### **Phase 6B: Provider Integration Tests** (High Value)
**Priority:** HIGH
**Target:** openai-provider.ts uncovered branches
**Estimated Coverage Gain:** +0.5-1%

Tests to add:
1. Organization header in different scenarios
2. Model listing with organization context
3. Error branches in streaming
4. Fallback behaviors

### **Phase 6C: GPU and Config Tests** (Polish)
**Priority:** MEDIUM
**Target:** nvml-provider.ts, config-loader.ts
**Estimated Coverage Gain:** +0.5-0.8%

Tests to add:
1. NVML error conditions
2. Config validation edge cases
3. Missing/malformed config fields

---

## Expected Outcomes

### If we implement Phase 6A only:
- **Coverage:** 95.48% → ~97% (+1.5%)
- **Tests:** 386 → ~395 (+9 tests)
- **Time:** ~30-45 minutes
- **Value:** HIGH - Core routing reliability

### If we implement Phase 6A + 6B:
- **Coverage:** 95.48% → ~97.5% (+2%)
- **Tests:** 386 → ~400 (+14 tests)
- **Time:** ~60-75 minutes
- **Value:** VERY HIGH - Core + provider reliability

### If we implement all phases (6A + 6B + 6C):
- **Coverage:** 95.48% → ~98% (+2.5%)
- **Tests:** 386 → ~410 (+24 tests)
- **Time:** ~90-120 minutes
- **Value:** EXCELLENT - Near-complete coverage

---

## Alternative Approach: Documentation & Tooling

Instead of chasing 98% coverage, we could focus on:

1. **Comprehensive Documentation:**
   - Update SESSION_SUMMARY.md with Phase 5
   - Create DEVELOPMENT_GUIDE.md
   - Add API documentation with TypeDoc

2. **Developer Tooling:**
   - Husky pre-commit hooks (lint + type-check)
   - Additional npm scripts
   - CI/CD pipeline configuration templates

3. **Quality Enhancements:**
   - Performance benchmarking baseline
   - Integration test improvements
   - E2E test scenarios

---

## Recommendation

**Recommended Path:** Phase 6A (Core Routing Tests)

**Rationale:**
1. **Strategic Value:** Core routing affects entire system behavior
2. **High ROI:** ~2% coverage gain with 9-10 high-value tests
3. **Production Critical:** Routing decisions are mission-critical
4. **Branch Coverage:** Improves branch coverage from 88.66% → ~91%
5. **Time Efficient:** 30-45 minutes for significant improvement

**Then:** Update comprehensive documentation with all phases

---

## Success Metrics

### Current State (Phase 5 Complete):
- ✅ Line Coverage: 95.48%
- ✅ Branch Coverage: 88.66%
- ✅ Function Coverage: 98.14%
- ✅ Total Tests: 386
- ✅ All tests passing

### Target State (Phase 6A Complete):
- 🎯 Line Coverage: ~97%
- 🎯 Branch Coverage: ~91%
- 🎯 Function Coverage: ~98.5%
- 🎯 Total Tests: ~395
- 🎯 All tests passing

### Stretch Target (Phase 6A + 6B):
- 🎯 Line Coverage: ~97.5%
- 🎯 Branch Coverage: ~92%
- 🎯 Function Coverage: ~99%
- 🎯 Total Tests: ~400
- 🎯 Near-perfect production readiness

---

## Decision Point

**Option 1:** Proceed with Phase 6A (Recommended)
- Focus on core routing tests
- Highest strategic value
- Quick wins

**Option 2:** Document current state and conclude
- Update SESSION_SUMMARY.md
- Create final comprehensive report
- 95.48% is already excellent

**Option 3:** Proceed with all phases (6A + 6B + 6C)
- Comprehensive coverage improvement
- Longer time investment
- Diminishing returns after 97%

**User Decision Needed:** Which path would you like to pursue?
