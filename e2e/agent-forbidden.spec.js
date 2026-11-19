// Parcours 7 : un agent n'accède ni à Utilisateurs ni au Journal d'audit (matrice des rôles, BR-20)
import { test, expect } from '@playwright/test';
import { login, USERS, apiToken, auth } from './helpers.js';

test('CT-P-07 le menu de l\'agent ne propose ni Users ni Audit log', async ({ page }) => {
  await login(page, USERS.agent1);
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link', { name: 'Clients' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Users' })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Audit log' })).toHaveCount(0);
});

for (const path of ['/users', '/audit']) {
  test(`CT-E-07 agent qui tape l'URL ${path} est redirigé`, async ({ page, request }) => {
    await login(page, USERS.agent1);
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);

    // Et l'API refuse aussi (403)
    const token = await apiToken(request, USERS.agent1);
    const res = await request.get(`/api${path}`, { headers: auth(token) });
    expect(res.status()).toBe(403);
  });
}
