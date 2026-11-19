// Parcours 2 : créer un client (§6.1)
import { test, expect } from '@playwright/test';
import { login, uid, USERS, apiToken, auth } from './helpers.js';

test('CT-P-02 création d\'un client', async ({ page }, testInfo) => {
  const name = `Client ${uid(testInfo)}`;
  await login(page, USERS.manager);
  await page.getByRole('link', { name: 'Clients' }).click();
  await page.getByRole('button', { name: 'New client' }).click();
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Email', { exact: true }).fill(`c${Date.now()}${testInfo.project.name}@e2e.tn`);
  await page.getByLabel('Phone').fill('71234567');
  await page.getByLabel('Company').fill('E2E SARL');
  await page.getByLabel('City').fill('Tunis');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/clients\/[0-9a-f]{24}$/);
  await expect(page.getByRole('heading', { name })).toBeVisible();
});

test('CT-E-02 client sans nom ou avec email invalide : rien n\'est créé', async ({ page, request }, testInfo) => {
  const name = `Invalide ${uid(testInfo)}`;
  await login(page, USERS.manager);
  await page.goto('/clients');
  await page.getByRole('button', { name: 'New client' }).click();
  const form = page.locator('form', { has: page.getByRole('heading', { name: 'New client' }) });

  // a) nom vide
  await page.getByLabel('Email', { exact: true }).fill('valide@e2e.tn');
  await page.getByLabel('Phone').fill('71234567');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByLabel('Name', { exact: true })).toHaveJSProperty('validity.valueMissing', true);
  await expect(page).toHaveURL(/\/clients$/);

  // b) email invalide
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Email', { exact: true }).fill('pas-un-email');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByLabel('Email', { exact: true })).toHaveJSProperty('validity.typeMismatch', true);
  await expect(page).toHaveURL(/\/clients$/);
  await expect(form).toBeVisible();

  // c) le serveur refuse aussi (la règle ne dépend pas que du navigateur)
  const token = await apiToken(request, USERS.manager);
  const res = await request.post('/api/clients', { headers: auth(token), data: { name, email: 'pas-un-email', phone: '71234567' } });
  expect(res.status()).toBe(400);
  // la recherche plein texte peut renvoyer d'autres clients : on vérifie le nom exact
  const list = await request.get(`/api/clients?search=${encodeURIComponent(name)}&limit=100`, { headers: auth(token) });
  expect((await list.json()).clients.filter(c => c.name === name)).toHaveLength(0);
});
