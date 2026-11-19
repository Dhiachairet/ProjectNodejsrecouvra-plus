// Parcours 5 : planifier une action de recouvrement puis la clôturer (BR-15, BR-16)
import { test, expect } from '@playwright/test';
import { login, uid, USERS, apiToken, auth, createClient, createInvoice, localDateTime } from './helpers.js';

async function setup(page, request, testInfo) {
  const id = uid(testInfo);
  const token = await apiToken(request, USERS.manager);
  const client = await createClient(request, token, `Action ${id}`);
  const invoice = await createInvoice(request, token, client._id, `E2E-ACT-${id}`.toUpperCase());
  await login(page, USERS.manager);
  await page.goto(`/invoices/${invoice._id}`);
  const section = page.locator('section', { has: page.getByRole('heading', { name: 'Collection actions' }) });
  await section.getByLabel('Type').selectOption('phone_call');
  await section.getByLabel('Planned date').fill(localDateTime(2));
  await section.getByLabel('Notes').fill('Relance téléphonique');
  await section.getByRole('button', { name: 'Plan action' }).click();
  const row = section.locator('tbody tr').first();
  await expect(row.locator('.badge')).toHaveText('Planned');
  return { token, invoice, section, row };
}

test('CT-P-05 action planifiée puis clôturée avec un résultat', async ({ page, request }, testInfo) => {
  const { row } = await setup(page, request, testInfo);
  await row.getByRole('button', { name: 'Complete' }).click();
  await row.getByLabel('Action result').fill('Client joint, paiement promis');
  await row.getByRole('button', { name: 'Complete' }).click();
  await expect(row.locator('.badge')).toHaveText('Completed');
  await expect(row).toContainText('Client joint, paiement promis');
});

test('CT-E-05 clôturer une action sans résultat est refusé', async ({ page, request }, testInfo) => {
  const { token, invoice, row } = await setup(page, request, testInfo);
  await row.getByRole('button', { name: 'Complete' }).click();
  await row.getByRole('button', { name: 'Complete' }).click();
  // Le champ obligatoire bloque l'envoi, l'action reste planifiée
  await expect(row.getByLabel('Action result')).toHaveJSProperty('validity.valueMissing', true);
  await row.getByRole('button', { name: 'Back' }).click();
  await expect(row.locator('.badge')).toHaveText('Planned');

  // Le serveur refuse aussi (BR-16)
  const detail = await (await request.get(`/api/invoices/${invoice._id}`, { headers: auth(token) })).json();
  const actionId = detail.collectionActions[0]._id;
  const res = await request.patch(`/api/collections/${actionId}/status`, { headers: auth(token), data: { status: 'completed' } });
  expect(res.status()).toBe(400);
});
