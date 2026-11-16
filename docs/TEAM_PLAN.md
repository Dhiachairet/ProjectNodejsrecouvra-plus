# Recouvra+ team plan

The app is built and covers section 4 of the specification. What remains is the graded part: proving the 8 ISO/IEC 25010 characteristics with real tests, real tools and real evidence.

Each student owns a set of characteristics end to end:
- the tests and the tool that runs them
- the real reports
- the bugs those tests reveal, and their fixes
- the matching rows of the traceability matrix
- that part of the ISO conformity report

That way everyone has their own commits and their own part to present.

## Who owns which characteristic

| § | Characteristic | Owner | Main tools |
|---|---|---|---|
| 6.1 | Functional suitability | Student 2 (E2E journeys by Student 4) | Jest, Supertest, Playwright |
| 6.2 | Performance efficiency | Student 4 | k6 |
| 6.3 | Compatibility | Student 4 | Playwright on Chromium, Firefox, WebKit · Newman |
| 6.4 | Usability | Student 4 | Playwright, axe-core, Lighthouse, user test |
| 6.5 | Reliability | Student 2 | Jest reliability scenarios, MongoDB transactions |
| 6.6 | Security | Student 3 | ESLint security, npm audit, OWASP ZAP, Supertest |
| 6.7 | Maintainability | Student 1 | ESLint, SonarQube, Jest coverage |
| 6.8 | Portability | Student 1 | Docker Compose, GitHub Actions |

---

## Student 1 (lead): Maintainability (6.7), Portability (6.8)

**Already delivered:** the base app (backend, React frontend, seed data, README, business rules BR-01 to BR-20).

### Build
1. **Shared test setup first.** Students 2 and 3 depend on it. It includes:
   - Jest configured for ES modules.
   - `mongodb-memory-server` in replica-set mode, which transactions need.
   - `tests/helpers/`, which starts the in-memory database, imports `src/app.js`, creates one user per role and returns their tokens.
   - One passing example test.
2. **Docker.**
   - A multi-stage `Dockerfile`: build the frontend, then run the API that serves it.
   - A `.dockerignore`.
   - A `docker-compose.yml` with MongoDB, the app and a one-off seed service.
3. **CI.** A GitHub Actions workflow on every pull request: install, lint, tests with coverage, `npm audit`, frontend build.
4. **Maintainability.**
   - ESLint on backend and frontend.
   - SonarQube Community in Docker, fed with Jest coverage.
   - Record complexity, duplication, coverage and technical debt.
   - Refactor one hotspot and show the numbers before and after.
5. **Portability test.**
   - Make a fresh clone on a machine that has never run the project.
   - Run `docker compose up`, then a script that checks `/health` and signs in.
   - Student 4 also follows the README without Docker.

### Write
- Design report: architecture, data model, and why this stack (2–3 lines, as the spec asks)
- Installation and run guide
- Traceability matrix template
- Final assembly of the ISO 25010 conformity report

### Find and fix
- The top issues SonarQube reports, with metrics before and after

| | |
|---|---|
| **Evidence** | SonarQube dashboard, coverage report, CI run, Compose logs, fresh-machine install log |
| **Owns** | `Dockerfile`, `docker-compose.yml`, `.github/workflows/`, `eslint.config.js`, `sonar-project.properties`, `tests/helpers/`, `docs/design-report.md` |
| **Presents** | Architecture, a live tour of the app with the 3 roles, Docker and the SonarQube dashboard |

---

## Student 2: Functional suitability (6.1), Reliability (6.5)

### Build
1. **Unit tests** (Jest) on pure logic:
   - every allowed and forbidden transition in `src/workflows/collectionAction.workflow.js`
   - the helpers in `src/utils/access.js`
   - the Joi schemas
   - the invoice status rule (BR-07)

   No database is needed, so this can start on day one.
2. **Integration tests** (Jest, Supertest, in-memory MongoDB):
   - Full CRUD for users, clients, invoices and collection actions.
   - One test per rule in [BUSINESS_RULES.md](BUSINESS_RULES.md). Student 3 covers the access-control rules BR-14, BR-17 and BR-20.
   - The old tests on branch `origin/feature/part-b` are a starting point.
3. **Reliability scenarios:**
   - Two status changes on the same action at once: only one may succeed (BR-19).
   - Two payments on one invoice at once: the total must never exceed the amount (BR-02).
   - MongoDB stopped during requests: the API returns a clean 5xx, doesn't crash, leaves no half-written data, and recovers when the database is back.
   - Client totals stay correct after payments and cancellations.
   - The suites run repeatedly to catch flaky behaviour.

### Find and fix
- Cancelling an invoice doesn't update the client's totals. `updateInvoice` uses `findByIdAndUpdate`, so the post-save hook never runs.
- A payment and the client totals are separate writes, and two simultaneous payments may overpay. Use a MongoDB transaction or a conditional update.
- An invoice only becomes "overdue" when it is saved again.

| | |
|---|---|
| **Evidence** | Jest HTML report and coverage, logs of the reliability runs |
| **Owns** | `tests/unit/`, `tests/integration/`, `tests/reliability/` |
| **Presents** | The unit and integration suites running live, coverage, one reliability scenario |

---

## Student 3: Security (6.6)

### Build
1. **Access-control tests** (Jest, Supertest):
   - Missing, malformed, expired and wrongly signed tokens, and deactivated users.
   - Every line of the role matrix in [BUSINESS_RULES.md](BUSINESS_RULES.md), for all 3 roles.
   - Portfolio isolation (BR-14) on every endpoint: agent A can never read or change agent B's clients, invoices, payments or actions.
2. **SAST:** ESLint with `eslint-plugin-security` (or Semgrep) on backend and frontend, plus the SonarQube security hotspots from Student 1's setup.
3. **SCA:** `npm audit` on backend and frontend, plus OWASP Dependency-Check or Snyk. Fix or justify every finding.
4. **DAST:** OWASP ZAP in Docker, run before and after the fixes: a baseline scan first, then an authenticated scan with a JWT.
5. Classify every finding in the OWASP Top 10 (2021).

### Find and fix
- **A01:** Anyone can create an admin account, because `POST /api/auth/register` accepts a role.
- **A01:** Some endpoints skip the portfolio check:
  - `GET /clients/:id`
  - `GET /clients/:id/invoices`
  - `GET /invoices/:id/payments`
  - `GET /collections/:id`
  - `GET /collections/invoice/:id`
  - `GET /collections/client/:id`
  - `POST /invoices/:id/payments`
  - `PUT /invoices/:id`
- **A03:** `sortBy` is taken straight from the query string.
- **A05, A07:** No security headers, no rate limit on sign-in, CORS open to every origin, and passwords can be 6 characters.
- The JWT is kept in `localStorage`. Document the risk, and optionally move it to an httpOnly cookie.

| | |
|---|---|
| **Evidence** | ZAP reports before and after, `npm audit` output, ESLint security report, security test report |
| **Owns** | `tests/security/`, `security/` (ZAP configuration and reports) |
| **Presents** | ZAP before and after, the security suite running live, the commit pair for the admin-registration fix |

---

## Student 4: Performance (6.2), Compatibility (6.3), Usability (6.4)

### Build
1. **E2E** (Playwright), with journeys per role:
   - Sign in and out.
   - Create a client.
   - Assign agents, as a manager.
   - Create an invoice and record payments until it's paid.
   - Plan a collection action, then complete it.
   - Check that dashboard filters change the figures.
   - Check that an agent can't open Users or Audit log.
   - Check that the admin sees all of the above in the audit log.
2. **Compatibility:**
   - The same suite on Chromium, Firefox and WebKit, plus a phone viewport.
   - API contract tests with Postman and Newman, built from `swagger.yaml` (status codes and response shape).
3. **Usability:**
   - An axe-core scan of every page from Playwright.
   - A Lighthouse accessibility score.
   - A short user test: 3 to 5 people do 5 tasks. Note success, time and errors, then have them fill in the SUS questionnaire.
4. **Performance** (k6):
   - Scenarios: sign in, invoice list with filters, invoice search, dashboard, add a payment.
   - Run 20 virtual users against the p95 < 500 ms target from §6.2 of the spec.
   - Then a stress run to find the breaking point.

### Find and fix
- `limit` has no maximum: `?limit=100000` returns everything in one response.
- The slowest endpoint under load. The dashboard runs about 12 aggregations; improve it with indexes, caching or fewer queries, and show the numbers before and after.
- The accessibility issues that axe and Lighthouse report.

| | |
|---|---|
| **Evidence** | Playwright HTML report with traces, Newman report, axe and Lighthouse reports, k6 summary, user test sheet |
| **Owns** | `e2e/`, `perf/`, `api-tests/`, `docs/usability/` |
| **Presents** | Playwright running live on two browsers, k6 results against the 500 ms target |

---

## Order of work

1. **Get everyone running.**
   - Student 1 pushes the base and adds everyone as GitHub collaborators.
   - Each student sets their git identity, clones the repo, follows the README, runs `npm run seed` and signs in with the 3 demo accounts.
2. **Capture the "before" state.** Everyone works in parallel:
   - Student 1 builds the shared test setup and Docker.
   - Student 2 writes the unit tests, which need no database.
   - Student 3 runs `npm audit` and a ZAP baseline on the current app, before anything is fixed.
   - Student 4 sets up Playwright and k6 and records baseline performance numbers.
3. **Test and fix.** Write the integration, security, E2E and performance suites. Every bug goes through a pull request: the failing test first, then the fix.
4. **Report and rehearse.**
   - Complete the traceability matrix.
   - Write each ISO section and the design report.
   - Re-run the installation on a fresh machine.
   - Rehearse the 10-minute demo twice.

## Team rules

- **Never claim a result you didn't run.** Save every real report in `docs/evidence/<characteristic>/` with its date. If a tool can't run on your machine, document the procedure and write "result not available", as section 8 of the spec requires.
- **Branches and pull requests.** Use one branch per task (`s2/integration-tests`, `s3/zap-scan`) and open a pull request into `main` that one teammate reviews. Protect `main` on GitHub so nobody pushes to it directly.
- **Your own account.** Commit from your own GitHub account, in small commits with clear messages. The professor reads the history.
- **Failing test, then fix.** For every bug, commit the failing test first and the fix in a separate commit. The history becomes the proof.
- **Folders have owners.** Don't edit a folder another student owns without telling them. Fixes in `src/` go through pull requests.

Each finished test adds one row to the traceability matrix. Format example, not a real result:

| Requirement | Test | Tool | Result | Evidence |
|---|---|---|---|---|
| BR-02 · A payment cannot exceed the balance | `tests/integration/payments.test.js` › rejects an overpayment | Jest + Supertest | Pass / Fail, from the real run | `docs/evidence/6.1/jest-report-<date>.html` |

## Deliverables (spec, section 8)

| Deliverable | Owner |
|---|---|
| Source code with Git history | Everyone |
| Design report: architecture, data model, justified choices | Student 1 |
| Traceability matrix | Student 1 (template), rows from everyone |
| Executable test suites with generated reports | Everyone, for their own layers |
| ISO 25010 conformity report with evidence per characteristic | Each student writes their characteristics, Student 1 assembles |
| Installation and run guide | Student 1, checked by Student 4 on a fresh machine |
| Live demo with at least 2 test layers running | Everyone (see below) |

## The 10-minute demo

The group gets 10 minutes in total, so about 2½ minutes each. Start MongoDB, the app and SonarQube before walking in. Three test layers run live, more than the 2 the spec requires.

| Time | Who | Shows |
|---|---|---|
| 0:00 – 2:30 | Student 1 | Architecture, the app with the 3 roles, Docker and SonarQube |
| 2:30 – 5:00 | Student 2 | Unit and integration suites live, coverage, one reliability scenario |
| 5:00 – 7:30 | Student 3 | Security suite live, ZAP before and after, the fix commits |
| 7:30 – 10:00 | Student 4 | Playwright live on two browsers, k6 results |
