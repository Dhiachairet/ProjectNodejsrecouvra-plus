# Fiche B — Dépendances backend vulnérables

Sources :
- Avant : `sca/npm-audit-backend-before-2026-11-17.json` (identifiants GHSA, plages vulnérables, direct/indirect).
- Après : `sca/npm-audit-backend-after-qs-2026-11-19.txt` (état final : 2 moderate, 0 en production). L'ancien run `sca/npm-audit-backend-after-2026-11-17.txt` (39) est un état intermédiaire.
- « Version actuelle » : version lue dans `node_modules/` du projet (état après correction).
- Les CVE ne figurent pas dans npm audit : seuls les GHSA sont indiqués.
- « Version qui corrige » : première version hors de la plage vulnérable donnée par npm audit.
- Frontend : 5 high avant (picomatch, fdir, tinyglobby, vite, @vitejs/plugin-react), 0 après (`sca/npm-audit-frontend-after-2026-11-18.txt`). Détail non conservé dans les fichiers.

## Corrigés (absents de l'audit « after »)

| Paquet | Version actuelle | Direct ou indirect | GHSA (avant) | Version qui corrige | Décision et raison |
|---|---|---|---|---|---|
| mongoose (critical) | 7.8.14 | Direct | GHSA-664h-wqgq-64gw, GHSA-gg4r-jv3p-qx3c, GHSA-pcrw-h46h-c93h, GHSA-wr5m-5jph-8m96, GHSA-8332-j7wj-wjw4, GHSA-6972-9mcm-vhwj | > 7.8.12 | Mis à jour : paquet runtime, sévérité critical. |
| proxy-addr (critical) | 2.0.8 | Indirect | GHSA-jqcg-44mw-7w3h | ≥ 2.0.8 | Mis à jour : paquet runtime, sévérité critical. |
| body-parser | 1.20.9 | Indirect | GHSA-v422-hmwv-36x6, GHSA-27r3-jxmh-p828 | > 1.20.8 | Mis à jour : paquet runtime. |
| joi | 17.13.9 | Direct | GHSA-q7cg-457f-vx79, GHSA-6w3j-5fw6-r9vr, GHSA-gg4h-3hg2-grpc, GHSA-wr44-6hxh-3jwq, GHSA-6h2x-m376-mqjq, GHSA-4528-x5fx-h6hg | > 17.13.8 | Mis à jour : validation des entrées, runtime. |
| path-to-regexp | 0.1.13 | Indirect | GHSA-37ch-88jc-xwx2 | 0.1.13 | Mis à jour : routage Express, runtime. |
| ip-address | 10.7.6 | Indirect | GHSA-v2v4-37r5-5v8g, GHSA-mwp4-54f8-5fhr, GHSA-rpw4-54j3-4h4q, GHSA-j6r3-76f7-8jcv, GHSA-h3mg-xc3c-68pw, GHSA-rxp7-6hxx-x8q5 | > 10.7.3 | Mis à jour. |
| form-data | 4.0.6 | Indirect | GHSA-hmw2-7cc7-3qxx | > 4.0.5 | Mis à jour. |
| js-yaml | 3.15.2 | Indirect | GHSA-h67p-54hq-rp68, GHSA-52cp-r559-cp3m, GHSA-5p4m-2wfm-xmqj, GHSA-2883-xcg3-v3hh | > 3.15.1 | Mis à jour. |
| brace-expansion | 1.1.22 | Indirect | plusieurs GHSA (dont GHSA-f886-m6hf-6m8v, GHSA-jxxr-4gwj-5jf2) | > 1.1.20 (branche 1.x) | Mis à jour. |
| browserslist | 4.29.6 | Indirect | GHSA-c83g-rgw3-j3cx, GHSA-73wf-gq98-2v4g | > 4.28.6 | Mis à jour. |

## Corrigés par l'override `qs` (2026-11-19)

| Paquet | Version avant → après | GHSA | Correction |
|---|---|---|---|
| qs | 6.14.3 → 6.17.1 (express, body-parser, supertest) | GHSA-q8mj-m7cp-5q26, GHSA-x5fp-wj9c-mxmx, GHSA-4mjr-xmp4-gh2g, GHSA-6pq8-jhm2-2vcw | `"overrides": { "qs": "^6.17.1" }` dans `package.json`, puis `npm install`. `npm ls qs` : 6.17.1 partout. |
| picomatch, anymatch, chokidar, micromatch, readdirp (jest, nodemon) | signalés (intermédiaire : 39) → plus signalés | GHSA-fc5q-39xc-vjpf, GHSA-3v7f-55p6-f55p, GHSA-c2c7-rcm5-vvqj | Plus présents dans l'audit final (`npm audit` : 2 vulnérabilités seulement). |

## Restants (audit final : 2 moderate, 0 en production)

| Paquet | Version actuelle | Direct ou indirect | GHSA | Version qui corrige | Décision et raison |
|---|---|---|---|---|---|
| minimatch | 10.2.6 (nodemon) | Indirect (via nodemon) | GHSA-g3hv-75wg-m249 | npm propose nodemon@3.1.11 (changement cassant) | Outillage de dev, non déployé en production. Non appliqué : correctif cassant. À suivre. |
| nodemon | 3.1.14 | Direct (dev) | — (hérite de minimatch) | — | Outil de développement uniquement. |

Remarque : `npm audit --omit=dev` donne 0 vulnérabilité. Dependency-Check (`sca/dependency-check-2026-11-17.html`) n'a pas été relancé : ses constats qs et picomatch datent d'avant le correctif ; il signale aussi formidable 2.1.5 (LOW), non couvert par npm audit.
