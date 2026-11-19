# Fiche D — Tests Jest + Supertest

Sources : `jest-tests/security-test-before--2026-11-18.txt`, `jest-tests/security-test-after--2026-11-18.txt`. Avant : 198 tests, 67 en échec ; après : 198 tests, 0 en échec. Cf. `RAPPORT-FINAL-COMPARATIF.md` §3.
Les .txt ne donnent que les échecs par fichier, pas les passes.

| N° | Fichier de test | Échecs avant | Après | Catégorie OWASP | Faille prouvée (avant) | Correction |
|---|---|---|---|---|---|---|
| 1 | `register` | 7 | OK | A01 | `/register` acceptait `role: admin` / `manager` ; création d'admin par agent/manager | Rôle forcé à `agent` |
| 2 | `portfolio-isolation` | 9 | OK | A01 | Lecture client, factures, paiements, dossier, actions ; modification et annulation de facture ; paiement sur le portefeuille d'un autre agent | Helpers `src/utils/access.js` |
| 3 | `role-matrix` | 6 | OK | A01 | 6 lectures autorisées à tort à un agent | Idem |
| 4 | `sort-injection` | 27 | OK | A03 | `$where`, `$natural`, `__proto__`, `constructor`, `password`, champ inconnu, `sortBy[$ne]`, sortBy répété, order invalide (clients, collections, invoices) | Liste blanche `src/utils/sort.js` |
| 5 | `headers-cors` | 10 | OK | A05 | 3 en-têtes Helmet manquants + 7 tests CORS | Helmet + CORS via `CORS_ORIGIN` |
| 6 | `rate-limit` | 2 | OK | A07 | Pas de 429 à la 11e tentative ; protection non garantie en production | `src/middleware/rateLimit.js` |
| 7 | `password-policy` | 6 | OK | A07 | 6 mots de passe faibles acceptés | Schéma Joi (10 car., majuscule, chiffre, symbole) |
| 8 | `auth-token` | 0 | OK | A07 | Aucune (suite déjà verte) | — |
| | **Total** | **67** | **0** | | | |

Source complémentaire (run du 17 nov., 4 suites) : `manual-tests/access-control-tests-{before,after}-fixes-2026-11-17.json` → 111 pass / 22 fail avant, 133 / 0 après.

Décision : toutes les failles prouvées par Jest sont corrigées. Non couvert : tests dédiés pour `/collections/invoice/:id` et `/collections/client/:id`.
