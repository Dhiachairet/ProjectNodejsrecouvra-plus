// §6.4 Accessibilité automatique (axe-core, WCAG 2 A/AA)
// Critère de sortie : 0 violation « critical » ou « serious ». Le résultat complet de chaque page
// est écrit dans test/evidence/6.4/axe/ pour la fiche d'analyse.
import fs from 'fs';
import path from 'path';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { login, USERS } from './helpers.js';

const OUT = path.resolve('test/evidence/6.4/axe');
const PAGES = [
  { name: 'dashboard', path: '/', heading: 'Dashboard' },
  { name: 'clients', path: '/clients', heading: 'Clients' },
  { name: 'invoices', path: '/invoices', heading: 'Invoices' },
  { name: 'actions', path: '/actions', heading: 'Collection actions' },
  { name: 'users', path: '/users', heading: 'Users' },
  { name: 'audit', path: '/audit', heading: 'Audit log' }
];

// Le DOM est identique sur tous les navigateurs : axe tourne une seule fois, sur Chromium
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'axe exécuté sur Chromium uniquement');
});

async function scan(page, name, testInfo) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const summary = results.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length }));
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify({ url: page.url(), summary, violations: results.violations }, null, 2));
  await testInfo.attach(`axe-${name}`, { body: JSON.stringify(summary, null, 2), contentType: 'application/json' });
  const blocking = summary.filter(v => ['critical', 'serious'].includes(v.impact));
  expect(blocking, `violations graves sur ${name}`).toEqual([]);
}

test('a11y login', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await scan(page, 'login', testInfo);
});

for (const p of PAGES) {
  test(`a11y ${p.path}`, async ({ page }, testInfo) => {
    await login(page, USERS.admin);
    await page.goto(p.path);
    await expect(page.getByRole('heading', { name: p.heading, exact: true })).toBeVisible();
    await expect(page.locator('table, .kpis').first()).toBeVisible();
    await scan(page, p.name, testInfo);
  });
}
