// Parcours 3 : un manager affecte des agents (relation N-N, BR-13)
import { test, expect } from '@playwright/test';
import { login, uid, USERS, apiToken, auth, createClient } from './helpers.js';

test('CT-P-03 le manager affecte 2 agents à un client', async ({ page, request }, testInfo) => {
  const token = await apiToken(request, USERS.manager);
  const client = await createClient(request, token, `Affect ${uid(testInfo)}`);
  await login(page, USERS.manager);
  await page.goto(`/clients/${client._id}`);
  const section = page.locator('section', { has: page.getByRole('heading', { name: 'Assigned agents' }) });
  await section.getByRole('checkbox').nth(0).check();
  await section.getByRole('checkbox').nth(1).check();
  await section.getByRole('button', { name: 'Save assignment' }).click();
  await expect(section.getByRole('status')).toHaveText('Assignment saved');

  const res = await request.get(`/api/clients/${client._id}`, { headers: auth(token) });
  expect((await res.json()).client.assignedAgents).toHaveLength(2);
});

test('CT-E-06 affecter un 4e agent est refusé (max 3)', async ({ page, request }, testInfo) => {
  const id = uid(testInfo);
  const admin = await apiToken(request, USERS.admin);
  // Il n'existe que 3 agents après le seed : on en crée un 4e pour pouvoir cocher 4 cases
  const reg = await request.post('/api/auth/register', {
    headers: auth(admin),
    data: { firstName: 'Agent', lastName: id, email: `agent-${id}@e2e.tn`, password: 'Password123!', role: 'agent' }
  });
  expect(reg.status()).toBe(201);
  const client = await createClient(request, admin, `Max3 ${id}`);

  await login(page, USERS.manager);
  await page.goto(`/clients/${client._id}`);
  const section = page.locator('section', { has: page.getByRole('heading', { name: 'Assigned agents' }) });
  const boxes = section.getByRole('checkbox');
  await expect(boxes.nth(3)).toBeVisible();
  for (let i = 0; i < 4; i++) await boxes.nth(i).check();
  await section.getByRole('button', { name: 'Save assignment' }).click();
  await expect(section.getByRole('alert')).toContainText('at most 3');

  const res = await request.get(`/api/clients/${client._id}`, { headers: auth(admin) });
  expect((await res.json()).client.assignedAgents).toHaveLength(0);
});
