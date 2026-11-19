# ESLint static analysis: ISO/IEC 25010, 6.7 Maintainability

Run on 2026-11-19 · Node 24.11.1 · Windows 11 · ESLint 10.15.0

## What is checked

One configuration ([eslint.config.js](../../../eslint.config.js)) covers the API (`src/`), scripts, tests, tool configs and the React frontend (`frontend/src/`, including `.jsx`).

| Rule set | Version | Purpose |
|---|---|---|
| `@eslint/js` recommended | 10.0.1 | Common bugs: unused variables, unreachable code, names that are not defined |
| `eslint-plugin-react-hooks` recommended-latest | 7.1.1 | Rules of hooks, effect dependencies, React Compiler checks |
| `eslint-plugin-react-refresh` | 0.5.8 | Files that break fast refresh in development |

Each part of the code gets only the global names that really exist where it runs:
- **The React app** gets browser globals.
- **Everything else** gets Node's ES-module globals.

The project uses ES modules, so the CommonJS-only names `require`, `module`, `exports`, `__dirname` and `__filename` are reported as undefined, because they crash at runtime here. So are `localStorage` and `sessionStorage` in Node code.

### Maintainability thresholds

These rules are set to **warning**, so they are measured without blocking a build. They apply to `src/` and `frontend/src/`.

| Rule | Threshold | Why |
|---|---|---|
| `complexity` | 10 per function | Cyclomatic complexity: number of independent paths, i.e. tests needed to cover a function |
| `max-depth` | 4 nesting levels | Deep nesting is hard to read and to test |
| `max-params` | 4 per function | Long parameter lists signal a function doing too much |
| `max-lines-per-function` | 80 lines (blank lines and comments excluded) | Long functions are hard to understand and change |

## How the reports were produced

```bash
npm run lint                                   # the analysis, printed in the terminal
npm run lint:report -- eslint-after-2026-11-19 # saves <name>.html and <name>.txt in this folder
```

- **[scripts/lint-report.js](../../../scripts/lint-report.js)** saves ESLint's real HTML and text output. It shortens absolute file paths to project-relative ones (no local folder or user name in shared files) and changes nothing else.
- **"Before" reports:** the code of commit `d18df5f` (`main` before this work), extracted with `git archive`, analysed with the final configuration, same path shortening. This is the same analysis as "after", on the original code.
- **[eslint-before-api-no-inline-config-2026-11-19.txt](eslint-before-api-no-inline-config-2026-11-19.txt):** the original `frontend/src/api.js` analysed with `--no-inline-config`. The original file silenced one warning with an `eslint-disable` comment; this run shows what that comment was hiding.

## Results

| | Before ([html](eslint-before-2026-11-19.html), [txt](eslint-before-2026-11-19.txt)) | After ([html](eslint-after-2026-11-19.html), [txt](eslint-after-2026-11-19.txt)) |
|---|---|---|
| Files analysed | 62 (18 `.jsx`) | 64 (18 `.jsx`) |
| Errors | **2** | **0** |
| Warnings | 16 (+1 hidden by an `eslint-disable` comment) | 15 |
| Functions over a maintainability threshold | 12 | 12 |
| `eslint-disable` comments in the code | 1 | 0 |

Two files are new after the work: `frontend/src/useAuth.js` (moved out of `auth.jsx`) and `scripts/lint-report.js`.

## What was fixed

| Finding | Rule | Fix |
|---|---|---|
| `errorHandler(err, req, res, next)`: `next` is never used | `no-unused-vars` (error) | Renamed to `_next`. The parameter cannot be removed: Express treats a middleware as an error handler only when it has 4 parameters. The config allows unused parameters that start with `_`. |
| `useApi` called `setState` synchronously inside `useEffect` to mark loading, causing an extra render on every request | `react-hooks/set-state-in-effect` (error) | `loading` is now derived from the last finished request instead of being stored. State changes only when a response arrives. Previous data stays visible while reloading, as before. |
| `useApi` hid a warning with `// eslint-disable-next-line react-hooks/exhaustive-deps`: the effect used `path` and `query` without listing them | `react-hooks/exhaustive-deps` (warning, hidden) | The effect now lists its real dependencies (`path`, the serialized query, the request key). The `eslint-disable` comment is gone, and there is none left in the code. |
| `auth.jsx` exported a component (`AuthProvider`) and a hook (`useAuth`) | `react-refresh/only-export-components` (warning) | `useAuth` and the context moved to `useAuth.js`, and the 11 files using the hook were updated. |

After the fixes ([regression-check-2026-11-19.txt](regression-check-2026-11-19.txt)):
- `npm test` passes (6/6).
- The frontend builds.
- `npm run lint` reports 0 errors.
- A scripted browser walkthrough as manager, agent and admin passes with no console errors. It covers dashboard filters, agent assignment, a workflow transition, role-based navigation and the audit log.

## Remaining warnings: refactoring backlog

All 15 remaining warnings are maintainability metrics. They were kept on purpose: they show where the code is hardest to maintain and are the candidates for the SonarQube-guided refactoring.

| Function | File | Measured | Threshold |
|---|---|---|---|
| `getStats` | `src/controllers/stats.controller.js` | 222 lines, complexity 11 | 80 lines, 10 |
| `buildScope` | `src/controllers/stats.controller.js` | complexity 17 | 10 |
| `api` | `frontend/src/api.js` | complexity 16 | 10 |
| `getInvoices` | `src/controllers/invoice.controller.js` | complexity 15 | 10 |
| `ClientForm` | `frontend/src/components/ClientForm.jsx` | complexity 15 | 10 |
| `getCollectionActions` | `src/controllers/collection.controller.js` | complexity 14 | 10 |
| `InvoiceDetail` | `frontend/src/pages/InvoiceDetail.jsx` | 94 lines, complexity 14 | 80, 10 |
| `Dashboard` | `frontend/src/pages/Dashboard.jsx` | 116 lines, complexity 13 | 80, 10 |
| `checkTransition` | `src/workflows/collectionAction.workflow.js` | complexity 12 | 10 |
| `getAuditLogs` | `src/controllers/audit.controller.js` | complexity 11 | 10 |
| `TransitionControl` | `frontend/src/components/TransitionControl.jsx` | complexity 11 | 10 |
| `ClientDetail` | `frontend/src/pages/ClientDetail.jsx` | 91 lines | 80 |

## Verdict

| Requirement | Result | Status |
|---|---|---|
| No ESLint errors | 0 errors | Conforms |
| No warning silenced with `eslint-disable` | 0 directives | Conforms |
| No function above the complexity and length thresholds | 12 functions above | Does not conform yet. Refactoring planned with SonarQube |
