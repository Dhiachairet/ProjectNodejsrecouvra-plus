// Parcours 1 : connexion et déconnexion (§6.1)
import { test, expect } from '@playwright/test';
import { login, USERS } from './helpers.js';

test('CT-P-01 connexion admin puis déconnexion', async ({ page }) => {
  await login(page, USERS.admin);
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  // Le jeton est supprimé : recharger la page ne reconnecte pas
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('CT-E-01 mauvais mot de passe refusé', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email').fill(USERS.admin);
  await page.getByLabel('Password').fill('MauvaisMotDePasse!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid credentials');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});
