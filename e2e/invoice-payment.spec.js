// Parcours 4 : créer une facture puis payer jusqu'au statut « payée » (BR-02, BR-07, BR-09)
import { test, expect } from '@playwright/test';
import { login, uid, USERS, apiToken, auth, createClient, createInvoice, isoDate } from './helpers.js';

const kpi = (page, label) => page.locator('.kpi', { has: page.locator('.kpi-label', { hasText: new RegExp(`^${label}$`) }) }).locator('.kpi-value');

test('CT-P-04 / CT-E-03 facture créée puis payée, paiement égal au solde accepté', async ({ page, request }, testInfo) => {
  const id = uid(testInfo);
  const token = await apiToken(request, USERS.manager);
  const client = await createClient(request, token, `Fact ${id}`);
  const number = `E2E-${id}`.toUpperCase();

  await login(page, USERS.manager);
  await page.goto(`/clients/${client._id}`);
  await page.getByRole('button', { name: 'New invoice' }).click();
  await page.getByLabel('Number').fill(number);
  await page.getByLabel('Amount').fill('1000');
  await page.getByLabel('Due date').fill(isoDate(30));
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name: `Invoice ${number}` })).toBeVisible();
  await expect(page.locator('.page-header .badge')).toHaveText('Unpaid');

  // Paiement partiel
  await page.getByLabel('Amount').fill('400');
  await page.getByRole('button', { name: 'Record payment' }).click();
  await expect(page.locator('.page-header .badge')).toHaveText('Partially paid');
  await expect(kpi(page, 'Outstanding')).toHaveText('600.00 TND');

  // Valeur limite valide : exactement le solde restant
  await page.getByLabel('Amount').fill('600');
  await page.getByRole('button', { name: 'Record payment' }).click();
  await expect(page.locator('.page-header .badge')).toHaveText('Paid');
  await expect(kpi(page, 'Outstanding')).toHaveText('0.00 TND');
  // Facture payée : plus de formulaire de paiement (BR-03)
  await expect(page.getByRole('button', { name: 'Record payment' })).toHaveCount(0);
});

test('CT-E-03 paiement de 0,01 au-dessus du solde refusé', async ({ page, request }, testInfo) => {
  const id = uid(testInfo);
  const token = await apiToken(request, USERS.manager);
  const client = await createClient(request, token, `Surpaie ${id}`);
  const invoice = await createInvoice(request, token, client._id, `E2E-OVER-${id}`.toUpperCase(), 1000);

  await login(page, USERS.manager);
  await page.goto(`/invoices/${invoice._id}`);
  const amount = page.getByLabel('Amount');
  await amount.fill('1000.01');
  await page.getByRole('button', { name: 'Record payment' }).click();
  // Le navigateur bloque (max = solde restant)
  await expect(amount).toHaveJSProperty('validity.rangeOverflow', true);
  await expect(page.getByText('No payments.')).toBeVisible();

  // Le serveur refuse aussi (BR-02), le solde reste inchangé
  const res = await request.post(`/api/invoices/${invoice._id}/payments`, { headers: auth(token), data: { amount: 1000.01, paymentMethod: 'cash' } });
  expect(res.status()).toBe(400);
  const after = await (await request.get(`/api/invoices/${invoice._id}`, { headers: auth(token) })).json();
  expect(after.invoice.paidAmount).toBe(0);
});

test('CT-E-04 facture avec date d\'échéance passée refusée (BR-09)', async ({ page, request }, testInfo) => {
  const id = uid(testInfo);
  const token = await apiToken(request, USERS.manager);
  const client = await createClient(request, token, `Passe ${id}`);
  const number = `E2E-PAST-${id}`.toUpperCase();

  await login(page, USERS.manager);
  await page.goto(`/clients/${client._id}`);
  await page.getByRole('button', { name: 'New invoice' }).click();
  await page.getByLabel('Number').fill(number);
  await page.getByLabel('Amount').fill('500');
  await page.getByLabel('Due date').fill(isoDate(-1));
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('alert')).toHaveText('Due date must be in the future');
  await expect(page).toHaveURL(new RegExp(`/clients/${client._id}$`));

  const res = await request.get(`/api/invoices?search=${number}`, { headers: auth(token) });
  expect((await res.json()).total).toBe(0);
});
