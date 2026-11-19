// Smoke test for a running deployment (Docker or not): the app is up, serves the React build and
// the API docs, and the API answers with the demo data. Run it after the seed.
// Usage: node scripts/smoke-test.js
//   BASE_URL (default http://localhost:3000), SMOKE_EMAIL, SMOKE_PASSWORD, SMOKE_TIMEOUT_SECONDS (default 90)
// Plain Node with the global fetch and no dependencies, so it runs without npm install.

// Drops trailing slashes with a plain loop: a /\/+$/ regex backtracks quadratically on long runs of slashes
function withoutTrailingSlashes(url) {
  let end = url.length;
  while (end > 0 && url[end - 1] === '/') end--;
  return url.slice(0, end);
}

const BASE_URL = withoutTrailingSlashes(process.env.BASE_URL || 'http://localhost:3000');
const EMAIL = process.env.SMOKE_EMAIL || 'admin@recouvra.tn';
const PASSWORD = process.env.SMOKE_PASSWORD || 'Password123!';
const TIMEOUT_SECONDS = Number(process.env.SMOKE_TIMEOUT_SECONDS) || 90;
const REQUEST_TIMEOUT_MS = 10_000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, { ...options, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    // HTML pages are expected for / and /api-docs/
  }
  return { status: response.status, type: response.headers.get('content-type') || '', text, body };
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

// The API puts its error text in "error", the 404 handler in "message"
const describe = (res) => [`HTTP ${res.status}`, res.body?.error ?? res.body?.message].filter(Boolean).join(' ');

// fetch only says "fetch failed" and hides the network error (ECONNREFUSED...) in error.cause
const reason = (error) => error.cause?.code ?? error.message;

async function waitForHealth() {
  const deadline = Date.now() + TIMEOUT_SECONDS * 1000;
  let last = 'no answer';
  while (Date.now() < deadline) {
    try {
      const res = await request('/health');
      if (res.status === 200 && res.body?.status === 'ok') return;
      last = describe(res);
    } catch (error) {
      last = reason(error);
    }
    await sleep(1000);
  }
  throw new Error(`not healthy after ${TIMEOUT_SECONDS} s (last: ${last})`);
}

let token;

const checks = [
  ['GET /health answers ok', waitForHealth],

  ['GET / serves the React index.html', async () => {
    const res = await request('/');
    expect(res.status === 200, describe(res));
    expect(res.type.includes('text/html') && res.text.includes('<div id="root">'), 'not the React index.html');
  }],

  ['GET /api-docs/ serves Swagger UI', async () => {
    const res = await request('/api-docs/');
    expect(res.status === 200, describe(res));
  }],

  ['POST /api/auth/login returns a token', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD })
    });
    expect(res.status === 200 && typeof res.body?.token === 'string', describe(res));
    token = res.body.token;
    return `as ${EMAIL}`;
  }],

  ['GET /api/stats returns the overview', async () => {
    expect(token, 'no token, the login check failed');
    const res = await request('/api/stats', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status === 200 && res.body?.success === true, describe(res));
    const overview = res.body.stats?.overview;
    expect(overview, 'stats.overview is missing');
    return `${overview.totalClients} clients, ${overview.totalInvoices} invoices`;
  }]
];

console.log(`Smoke test against ${BASE_URL}`);
let failed = 0;
for (const [name, check] of checks) {
  const started = Date.now();
  try {
    const detail = await check();
    console.log(`PASS  ${name} (${Date.now() - started} ms)${detail ? `: ${detail}` : ''}`);
  } catch (error) {
    failed++;
    console.log(`FAIL  ${name} (${Date.now() - started} ms): ${reason(error)}`);
  }
}
console.log(failed ? `${failed} of ${checks.length} checks failed` : `All ${checks.length} checks passed`);
process.exitCode = failed ? 1 : 0;
