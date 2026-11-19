// Summarises the CPU / memory files written by perf/mesure.sh.
//   node perf/analyse-ressources.mjs <label> [<label> ...]
// For the API, every `top` sample is the SUM over all Node processes (1 process in single mode,
// primary + workers in cluster mode). 100 % CPU = one full core.
import fs from 'node:fs';

const dir = 'test/evidence/6.2';

function api(label) {
  const samples = [];
  let current = null;
  for (const line of fs.readFileSync(`${dir}/cpu-mem-api-${label}.txt`, 'utf8').split('\n')) {
    if (line.startsWith('top -')) {
      if (current) samples.push(current);
      current = { cpu: 0, memMiB: 0, processes: 0 };
      continue;
    }
    const cols = line.trim().split(/\s+/);
    if (current && /^\d+$/.test(cols[0]) && cols.length >= 12) {
      const res = cols[5];
      const kib = res.endsWith('g') ? parseFloat(res) * 1024 * 1024 : res.endsWith('m') ? parseFloat(res) * 1024 : parseFloat(res);
      current.cpu += parseFloat(cols[8].replace(',', '.'));
      current.memMiB += kib / 1024;
      current.processes += 1;
    }
  }
  if (current) samples.push(current);
  const busy = samples.slice(1).filter(s => s.cpu > 5); // first sample is the idle state before k6 starts
  const avg = busy.reduce((sum, s) => sum + s.cpu, 0) / (busy.length || 1);
  return {
    processes: Math.max(...samples.map(s => s.processes)),
    cpuMax: Math.max(...samples.map(s => s.cpu)).toFixed(0) + ' %',
    cpuAvgUnderLoad: avg.toFixed(0) + ' %',
    memMax: Math.max(...samples.map(s => s.memMiB)).toFixed(0) + ' MiB'
  };
}

function mongo(label) {
  const lines = fs.readFileSync(`${dir}/cpu-mem-mongo-${label}.txt`, 'utf8').trim().split('\n');
  const cpu = lines.map(l => parseFloat(l.match(/CPU=([\d.]+)%/)?.[1] ?? 0));
  const mem = lines.map(l => parseFloat(l.match(/MEM=([\d.]+)MiB/)?.[1] ?? 0));
  return { cpuMax: Math.max(...cpu).toFixed(0) + ' %', memMax: Math.max(...mem).toFixed(0) + ' MiB' };
}

for (const label of process.argv.slice(2)) {
  console.log(label, JSON.stringify({ api: api(label), mongo: mongo(label) }));
}
