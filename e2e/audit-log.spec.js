// Parcours 8 : l'admin voit les actions dans le journal d'audit
import { test, expect } from '@playwright/test';
import { login, uid, USERS } from './helpers.js';

test('CT-P-08 une création de client apparaît dans le journal d\'audit', async ({ page }, testInfo) => {
  const name = `Audit ${uid(testInfo)}`;
  await login(page, USERS.admin);
  await page.goto('/clients');
  await page.getByRole('button', { name: 'New client' }).click();
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Email', { exact: true }).fill(`a${Date.now()}${testInfo.project.name}@e2e.tn`);
  await page.getByLabel('Phone').fill('71234567');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();

  await page.getByRole('link', { name: 'Audit log' }).click();
  await page.getByLabel('Area').selectOption('client.create');
  const row = page.locator('tbody tr', { hasText: name });
  await expect(row).toBeVisible();
  await expect(row).toContainText(USERS.admin);
  await expect(row).toContainText('Client created');
});

test('CT-P-09 la connexion échouée est tracée', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email').fill(USERS.agent2);
  await page.getByLabel('Password').fill('faux-mot-de-passe');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toBeVisible();

  await login(page, USERS.admin);
  await page.goto('/audit');
  await page.getByLabel('Area').selectOption('auth.login_failed');
  // Other tests running in parallel also log failed logins: look for agent2's row, not just the first one
  await expect(page.locator('tbody tr', { hasText: USERS.agent2 }).first()).toContainText('Failed login');
});
