// Saves the real ESLint output as evidence: an HTML and a text report in docs/evidence/6.7/.
// Absolute paths are shortened to project-relative ones, so no local folder or user name ends up
// in shared files. Nothing else in the output is changed.
// Usage: npm run lint:report -- <name>     e.g. npm run lint:report -- eslint-after-2026-11-19
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const name = process.argv[2];

if (!name || !/^[\w.-]+$/.test(name)) {
  console.error('Usage: npm run lint:report -- <name>   (letters, digits, dot, dash, underscore)');
  process.exit(1);
}

const eslint = path.join(root, 'node_modules', 'eslint', 'bin', 'eslint.js');
const outDir = path.join(root, 'docs', 'evidence', '6.7');

// The project root as it appears in the outputs: native separators, forward slashes,
// and doubled backslashes inside the JSON that the HTML report embeds.
const prefixes = [
  root + path.sep,
  root.split(path.sep).join('/') + '/',
  root.split('\\').join('\\\\') + '\\\\'
];
const relativize = (text) => prefixes.reduce((out, prefix) => out.split(prefix).join(''), text);

fs.mkdirSync(outDir, { recursive: true });

for (const [format, extension] of [['html', 'html'], ['stylish', 'txt']]) {
  const run = spawnSync(process.execPath, [eslint, '.', '-f', format], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  // ESLint exits with 0 (clean) or 1 (problems found); 2 means it could not run
  if (run.error || run.status === 2) {
    console.error(run.error?.message ?? run.stderr);
    process.exit(2);
  }
  const file = path.join(outDir, `${name}.${extension}`);
  fs.writeFileSync(file, relativize(run.stdout));
  console.log(`Saved ${path.relative(root, file)}`);
}
