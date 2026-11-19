// Lighthouse (accessibilité) sur toutes les pages, y compris celles derrière la connexion.
// Playwright ouvre Chromium avec un port de débogage et se connecte en admin (jeton en localStorage),
// puis Lighthouse audite chaque page dans ce même navigateur sans effacer le stockage.
// Prérequis : app lancée (npm start), Lighthouse installé globalement (npm i -g lighthouse).
// Usage : node test/lighthouse-pages.mjs   (ou LH_OUT=test/evidence/6.4/lighthouse-apres node test/lighthouse-pages.mjs)
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { chromium } from '@playwright/test';

const { default: lighthouse } = await import(path.join(execSync('npm root -g').toString().trim(), 'lighthouse/core/index.js'));
const OUT = process.env.LH_OUT || 'test/evidence/6.4/lighthouse'; // LH_OUT=… pour garder avant/après côte à côte
const PORT = 9555;
const PAGES = { login: '/', dashboard: '/', clients: '/clients', invoices: '/invoices', actions: '/actions', users: '/users', audit: '/audit' };

fs.mkdirSync(OUT, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-'));
const context = await chromium.launchPersistentContext(profile, { headless: true, args: [`--remote-debugging-port=${PORT}`] });
const page = await context.newPage();
const rows = [];

try {
  for (const [name, url] of Object.entries(PAGES)) {
    if (name === 'dashboard') {
      // connexion par le vrai formulaire avant les pages protégées
      await page.goto('http://localhost:3000/');
      await page.getByLabel('Email').fill('admin@recouvra.tn');
      await page.getByLabel('Password').fill('Password123!');
      await page.getByRole('button', { name: 'Sign in' }).click();
      await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
    }
    const result = await lighthouse(`http://localhost:3000${url}`, {
      port: PORT, onlyCategories: ['accessibility'], disableStorageReset: true, output: ['html', 'json'], logLevel: 'error'
    });
    const [html, json] = result.report;
    fs.writeFileSync(`${OUT}/${name}.report.html`, html);
    fs.writeFileSync(`${OUT}/${name}.report.json`, json);
    const lhr = result.lhr;
    const failed = Object.values(lhr.audits).filter(a => a.score === 0 && a.scoreDisplayMode === 'binary').map(a => a.id);
    rows.push({ page: name, url, score: Math.round(lhr.categories.accessibility.score * 100), echecs: failed.join(',') || 'aucun' });
    console.log(rows.at(-1));
  }
} finally {
  await context.close();
  fs.rmSync(profile, { recursive: true, force: true });
}
fs.writeFileSync(`${OUT}/resume.json`, JSON.stringify(rows, null, 2));
