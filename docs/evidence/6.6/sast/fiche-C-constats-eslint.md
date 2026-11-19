# Fiche C — Constats SAST (ESLint security)

Sources : `sast/eslint-security-before-2026-11-17.json` (33 fichiers, 2 erreurs, 4 warnings), `sast/eslint-security-after-2026-11-19.json` (36 fichiers, **0 erreur, 0 warning**, commande `npx eslint src frontend/src`). Le run `sast/eslint-security-after-2026-11-18.json` (2 erreurs, 4 warnings) précède la correction ESLint. Cf. `RAPPORT-FINAL-COMPARATIF.md` §4.

| N° | Règle | Sévérité | Fichier:ligne (avant) | Avant / Après | Catégorie OWASP | Correction appliquée |
|---|---|---|---|---|---|---|
| 1 | `no-unused-vars` (`next` inutilisé) | Erreur | `src/middleware/errorHandler.js:3` | Présent / Corrigé | — (qualité) | Signature à 4 paramètres conservée (requise par Express) ; `next` utilisé : `if (res.headersSent) return next(err)`. |
| 2 | `react-hooks/exhaustive-deps` (règle introuvable) | Erreur | `frontend/src/api.js:55` | Présent / Corrigé | — (configuration) | `eslint-plugin-react-hooks` installé et configuré dans `eslint.config.js` ; `eslint-disable` supprimé ; dépendances de `useApi` corrigées. |
| 3 | `security/detect-object-injection` | Warning | `useForm.js:11` | Présent / Corrigé | A03 Injection | Lecture limitée aux propriétés propres (`Object.hasOwn`). |
| 4 | `security/detect-object-injection` | Warning | `collectionAction.workflow.js:18` | Présent / Corrigé | A03 | Recherche via `Map` : un statut inconnu (`constructor`, `__proto__`) ne résout plus vers le prototype. |
| 5 | `security/detect-unsafe-regex` | Warning | `Client.js:15` | Présent / Corrigé | A03 / A05 (ReDoS) | Regex remplacée par `isValidEmail` (`src/utils/email.js`), temps linéaire. |
| 6 | `security/detect-unsafe-regex` | Warning | `User.js:11` | Présent / Corrigé | A03 / A05 (ReDoS) | Idem. |

Vérification : l'équivalence de `isValidEmail` avec l'ancienne regex a été testée sur 400 000 chaînes aléatoires (0 divergence) ; `tests/security/email-validation.test.js` couvre les cas valides, invalides et une charge ReDoS. Tests : `jest-tests/security-test-after-eslint-2026-11-19.txt` (227/227) ; `npm test` complet : 233/233.

Limite : 24 warnings `detect-object-injection` subsistent dans `scripts/seed.js` et `tests/` (hors périmètre de cette analyse).
