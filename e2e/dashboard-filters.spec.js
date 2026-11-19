// Parcours 6 : les filtres du tableau de bord changent les chiffres
// Les autres tests créent des factures en parallèle : on compare les nombres (filtré < global)
// plutôt qu'un texte exact.
import { test, expect } from '@playwright/test';
import { login, USERS } from './helpers.js';

const invoiced = (page) => page.locator('.kpi', { has: page.locator('.kpi-label', { hasText: /^Invoiced$/ }) });

async function invoiceCount(page) {
  await expect(invoiced(page)).toContainText(/\d+ invoices/);
  const text = await invoiced(page).textContent();
  return Number(text.match(/(\d+) invoices/)[1]);
}

// Attend que le KPI change par rapport à `before`, puis renvoie la nouvelle valeur
async function countAfterChange(page, before) {
  await expect.poll(() => invoiceCount(page)).not.toBe(before);
  return invoiceCount(page);
}

test('CT-P-06 filtrer par client puis par agent change les KPI', async ({ page }) => {
  await login(page, USERS.admin);
  const all = await invoiceCount(page);
  expect(all).toBeGreaterThan(1000);

  const filters = page.getByRole('form', { name: 'Dashboard filters' });
  const clientSelect = filters.getByLabel('Client');
  await expect(clientSelect.locator('option')).not.toHaveCount(1);
  await clientSelect.selectOption({ index: 1 });
  const byClient = await countAfterChange(page, all);
  expect(byClient).toBeLessThan(all);

  await filters.getByRole('button', { name: 'Reset' }).click();
  const reset = await countAfterChange(page, byClient);
  expect(reset).toBeGreaterThanOrEqual(all);

  await filters.getByLabel('Agent').selectOption({ index: 1 });
  const byAgent = await countAfterChange(page, reset);
  expect(byAgent).toBeLessThan(reset);
});

test('CT-E-08 période sans données : les KPI tombent à zéro', async ({ page }) => {
  await login(page, USERS.admin);
  const filters = page.getByRole('form', { name: 'Dashboard filters' });
  await filters.getByLabel('From').fill('1990-01-01');
  await filters.getByLabel('To').fill('1990-12-31');
  await expect(invoiced(page)).toContainText(/(^|\D)0 invoices/);
});
