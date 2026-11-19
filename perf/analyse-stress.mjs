// Découpe le CSV brut de k6 en fenêtres de 30 s : utilisateurs actifs, débit, p95, erreurs.
// Usage : node perf/analyse-stress.mjs test/evidence/6.2/k6-stress-points.csv.gz
import fs from 'fs';
import zlib from 'zlib';

const file = process.argv[2];
let text = fs.readFileSync(file);
if (file.endsWith('.gz')) text = zlib.gunzipSync(text);
const lines = text.toString().trim().split('\n');
const cols = lines[0].split(',');
const iName = cols.indexOf('metric_name'), iTs = cols.indexOf('timestamp'), iVal = cols.indexOf('metric_value');

const start = Number(lines[1].split(',')[iTs]);
const win = new Map();
for (const line of lines.slice(1)) {
  const c = line.split(',');
  const w = Math.floor((Number(c[iTs]) - start) / 30);
  if (!win.has(w)) win.set(w, { dur: [], failed: 0, reqs: 0, vus: 0 });
  const b = win.get(w);
  const v = Number(c[iVal]);
  if (c[iName] === 'http_req_duration') b.dur.push(v);
  if (c[iName] === 'http_req_failed') { b.reqs++; b.failed += v; }
  if (c[iName] === 'vus') b.vus = Math.max(b.vus, v);
}
const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)] ?? 0; };

console.log('fenetre\tutilisateurs_max\trequetes_par_s\tp50_ms\tp95_ms\terreurs_%');
for (const [w, b] of [...win].sort((a, b) => a[0] - b[0])) {
  if (!b.dur.length) continue;
  console.log(`${w * 30}-${w * 30 + 30}s\t${b.vus}\t${(b.dur.length / 30).toFixed(1)}\t${pct(b.dur, 0.5).toFixed(0)}\t${pct(b.dur, 0.95).toFixed(0)}\t${(100 * b.failed / (b.reqs || 1)).toFixed(2)}`);
}
