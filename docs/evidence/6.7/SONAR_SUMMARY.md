# SonarQube analysis and refactoring: ISO/IEC 25010, 6.7 Maintainability

Run on 2026-11-19 · SonarQube Community Build 26.11 (local, Docker) · scanner `@sonar/scan` 5.1 · Node 24.11.1

## Setup

- Settings: [sonar-project.properties](../../../sonar-project.properties). The API, the React app and the scripts are analysed, the tests are marked as tests, and the coverage comes from `npm run test:coverage` (`coverage/lcov.info`).
- Quality gate: SonarQube's default "Sonar way". It checks the **new code** since the baseline: no new issue, at least 80 % coverage and at most 3 % duplication.
- Reproduce: see "Code quality (SonarQube)" in the [README](../../../README.md).

The numbers below come from the SonarQube web API right after each analysis. The JSON files hold the raw measures, and the screenshots show the dashboard.

## Before and after

**Before:** commit `19ed241` (branch `s1/eslint`), 6 tests ([measures](sonar-before-2026-11-19.md), [issues](sonar-before-2026-11-19-issues.md), [raw](sonar-before-2026-11-19.json), [dashboard](sonar-before-2026-11-19-dashboard.png)).

**After:** this branch, with the statistics refactoring and 37 tests ([measures](sonar-after-2026-11-19.md), [issues](sonar-after-2026-11-19-issues.md), [raw](sonar-after-2026-11-19.json), [dashboard](sonar-after-2026-11-19-dashboard.png)).

| Measure | Before | After |
|---|---|---|
| Quality gate | Passed | **Passed** |
| Maintainability rating (open issues) | A (18) | **A (18)** |
| Technical debt | 42 min (debt ratio 0.0 %) | 42 min (0.0 %) |
| Duplicated lines | 0.0 % | 0.0 % |
| Coverage, lines / branches | 43.8 % (43.4 % / 59.3 %) | **55.5 % (54.0 % / 80.8 %)** |
| Lines of code | 4,035 | 4,120 |
| Reliability rating (open issues) | D (22) | D (22) |
| Security rating (open issues) | D (4) | D (4) |

The SonarQube coverage also counts the React app, which has no unit tests. That is why it is lower than Jest's figure for the API (59.4 % of lines).

## Refactoring of the dashboard statistics

**Why this code:** it was the clearest maintainability hotspot.
- ESLint ([ESLINT_SUMMARY.md](ESLINT_SUMMARY.md)): `getStats` was 222 lines long with complexity 11, and `buildScope` had complexity 17.
- SonarQube: the file had only 6.9 % coverage.

**What changed:** the controller now only validates the request, calls the service and sends the response. The logic moved to [src/services/stats.service.js](../../../src/services/stats.service.js), which has one small named function per dashboard figure: scope, totals, by status, by month, top debtors, collected by agent, recent activity and so on. The MongoDB queries themselves were not changed.

| File | Lines of code | Functions | Cognitive complexity | Coverage |
|---|---|---|---|---|
| `src/controllers/stats.controller.js`, before | 292 | | 17 | 6.9 % |
| `src/controllers/stats.controller.js`, after | 31 | 2 | 3 | 86.7 % |
| `src/services/stats.service.js`, new | 260 | 32 | 15 | 100.0 % |

ESLint after the refactoring ([html](eslint-after-refactor-2026-11-19.html), [txt](eslint-after-refactor-2026-11-19.txt)):

| | Before | After |
|---|---|---|
| Errors | 0 | 0 |
| Warnings | 15 | 12 |
| Warnings in the statistics code | 3 | **0** |
| Functions above a maintainability threshold | 12 | 10 |

**How we know nothing changed**

1. **Characterization tests first.** 31 tests ([tests/integration/stats.test.js](../../../tests/integration/stats.test.js)) were written against the original code, then committed before the refactoring.
   - They cover every figure, every filter (period, agent, client), the agent portfolio restriction and the validation errors, with exact expected values.
   - They pass on the original code and on the refactored code: 31/31 both times ([log](stats-tests-before-after-refactor-2026-11-19.txt)).
   - They were also run in 7 time zones and at tricky dates (New Year, 29 February, daylight-saving days, just before midnight).
   - In a mutation check, 20 of 21 deliberately injected bugs made a test fail. The 21st cannot change any result: an overdue invoice can never be due in the next 7 days.
2. **Side by side on the real data.** The old and new code ran at the same time on the same seeded database. 42 requests went to both: every filter combination, as admin, manager and agent, plus the summary and the error cases. All 42 answers are equal ([log](refactor-equivalence-2026-11-19.txt)).
   - 15 of them are byte-identical.
   - In the other 27, only the order of keys inside `collectionStats` or `userStats` differs. The split between the two changes from run to run. MongoDB does not guarantee the order of grouped results, and the original code alone already returns those keys in varying order from one call to the next.

**A new issue, found and fixed:** the first "after" scan failed the quality gate on 1 new issue. A regular expression in `scripts/smoke-test.js`, used to remove trailing slashes from a URL, could backtrack quadratically. It was replaced by a plain loop; the gate then passed with 0 new issues and 100 % coverage of the new code.

## Remaining findings

- **Maintainability:**
  - 10 functions are still above the ESLint thresholds (listed in the ESLint report).
  - 18 small SonarQube issues remain, mostly `parseInt` instead of `Number.parseInt`, which are quick fixes.
- **Reliability (D) and security (D)** are rated from issues outside this refactoring, and they belong to the reliability and security work:
  - promises that are never awaited, in `server.js` and 3 React pages;
  - email regular expressions open to catastrophic backtracking in `models/Client.js` and `models/User.js`;
  - CORS open to every origin, and Express revealing its version.

## Verdict

| Requirement | Result | Status |
|---|---|---|
| Maintainability rating A | A | Conforms |
| Duplicated lines below 3 % | 0.0 % | Conforms |
| Quality gate on new code | Passed (0 new issues, 100 % coverage, 0 % duplication) | Conforms |
| Coverage measured | 55.5 % (SonarQube), 59.4 % of API lines (Jest) | Measured. It rises as the team adds tests |
| No function above the complexity and length thresholds | 10 functions above (12 before) | Does not conform yet: improved, not finished |
