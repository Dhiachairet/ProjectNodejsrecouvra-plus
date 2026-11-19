// Calcule le score SUS de chaque participant et la moyenne, et le taux de réussite des tâches.
// Usage : node test/usability/calcul-sus.mjs
import fs from 'fs';

const rows = (file) => fs.readFileSync(new URL(file, import.meta.url), 'utf8').trim().split('\n').slice(1).filter(Boolean).map(l => l.split(','));

const sus = rows('./sus-resultats.csv').map(([p, ...answers]) => {
  const score = answers.map(Number).reduce((sum, v, i) => sum + (i % 2 === 0 ? v - 1 : 5 - v), 0) * 2.5;
  return { participant: p, sus: score };
});
const obs = rows('./observations.csv');

if (!sus.length && !obs.length) {
  console.log('Résultat non disponible : aucune donnée saisie (session utilisateur pas encore réalisée).');
  process.exit(0);
}
console.table(sus);
if (sus.length) {
  const mean = sus.reduce((s, r) => s + r.sus, 0) / sus.length;
  console.log(`SUS moyen : ${mean.toFixed(1)} (objectif ≥ 68) → ${mean >= 68 ? 'RÉUSSI' : 'ÉCHOUÉ'}`);
}
if (obs.length) {
  const ok = obs.filter(r => r[2].toUpperCase() === 'O').length;
  const rate = (100 * ok) / obs.length;
  const slow = obs.filter(r => Number(r[3]) > 120).length;
  console.log(`Réussite des tâches : ${rate.toFixed(0)} % (${ok}/${obs.length}, objectif ≥ 80 %) → ${rate >= 80 ? 'RÉUSSI' : 'ÉCHOUÉ'}`);
  console.log(`Tâches au-dessus de 2 min : ${slow}`);
}
