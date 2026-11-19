// §6.3 Compatibilité mobile : aucune page ne doit déborder horizontalement de l'écran
import { test, expect } from '@playwright/test';
import { login, USERS } from './helpers.js';

const PAGES = ['/', '/clients', '/invoices', '/actions', '/users', '/audit'];

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mesure faite sur le profil mobile (Pixel 7)');
});

for (const path of PAGES) {
  test(`CT-E-09 pas de débordement horizontal sur mobile ${path}`, async ({ page }, testInfo) => {
    await login(page, USERS.admin);
    await page.goto(path);
    await expect(page.locator('main.content h1')).toBeVisible();
    await page.waitForLoadState('networkidle');
    // Si le contenu est plus large que l'écran, le navigateur mobile dézoome et innerWidth grandit :
    // on compare donc la largeur réelle de la page à la largeur physique de l'écran (412 px pour le Pixel 7)
    const viewport = page.viewportSize().width;
    const size = { viewport, page: await page.evaluate(() => document.documentElement.scrollWidth) };
    await testInfo.attach('largeurs', { body: JSON.stringify(size), contentType: 'application/json' });
    await page.screenshot({ path: `test/evidence/6.3/mobile${path === '/' ? '/dashboard' : path}.png`, fullPage: false });
    expect(size.page, `largeur de page ${size.page}px pour un écran de ${size.viewport}px`).toBeLessThanOrEqual(size.viewport);
  });
}
