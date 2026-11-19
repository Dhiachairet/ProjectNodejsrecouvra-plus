# Fiche C — Constats SAST (ESLint security)

Sources : `sast/eslint-security-before-2026-11-17.json` (33 fichiers), `sast/eslint-security-after-2026-11-18.json` (35 fichiers). Résultat identique : 2 erreurs, 4 warnings. Cf. `RAPPORT-FINAL-COMPARATIF.md` §4. Les colonnes V/F et décision sont une analyse à valider par l'équipe.

| N° | Règle | Sévérité | Fichier:ligne | Avant / Après | Catégorie OWASP | V/F | Décision et raison |
|---|---|---|---|---|---|---|---|
| 1 | `no-unused-vars` (`next` inutilisé) | Erreur | `src/middleware/errorHandler.js:3` | Présent / Présent | — (qualité) | F (pas une faille) | Restant, préexistant. Le paramètre `next` est requis par la signature d'un error handler Express ; à corriger par `_next` ou une exception ESLint. |
| 2 | `react-hooks/exhaustive-deps` (règle introuvable) | Erreur | `frontend/src/api.js:55` | Présent / Présent | — (configuration) | F | Restant. Problème de configuration ESLint, pas de vulnérabilité. |
| 3 | `security/detect-object-injection` | Warning | `useForm.js:11` | Présent / Présent | A03 Injection | À vérifier | Restant. Accès par clé dynamique ; à contrôler manuellement. |
| 4 | `security/detect-object-injection` | Warning | `collectionAction.workflow.js:18` | Présent / Présent | A03 | À vérifier | Restant. Idem. |
| 5 | `security/detect-unsafe-regex` | Warning | `Client.js:15` | Présent / Présent | A03 / A05 (ReDoS) | À vérifier | Restant. Regex à analyser (risque de ReDoS). |
| 6 | `security/detect-unsafe-regex` | Warning | `User.js:11` | Présent / Présent | A03 / A05 (ReDoS) | À vérifier | Restant. Idem. |

Conclusion : aucune règle de sécurité nouvelle déclenchée par le code ajouté (35 fichiers analysés après correction). Les corrections de cette campagne ne relèvent pas de l'analyse statique.
