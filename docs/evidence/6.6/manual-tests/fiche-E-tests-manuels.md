# Fiche E — Tests manuels D01-D08

Sources : `rapport_tests_securite_recouvra_avant_correction.md`, `rapport_tests_securite_recouvra_apres_correction.md`. Bilan : avant 6 FAIL / 2 PASS ; après 8 PASS / 0 FAIL.

| ID | Test | Résultat avant | Résultat après | Décision | Preuve |
|---|---|---|---|---|---|
| D01 | En-têtes de sécurité HTTP | FAIL (CSP, X-Frame-Options, X-Content-Type-Options absents ; CORS `*`) | PASS | Corrigé : Helmet + CORS restreint (`CORS_ORIGIN`) | Jest `headers-cors` ; ZAP |
| D02 | Exposition de la technologie (`X-Powered-By`) | FAIL (`X-Powered-By: Express`) | PASS | Corrigé : `app.disable('x-powered-by')` | Jest `headers-cors` ; ZAP |
| D03 | Création d'un compte administrateur via `role` | FAIL (compte créé avec le rôle `admin`) | PASS (rôle forcé à `agent`) | Corrigé : rôle forcé à `agent` | Burp captures 2 et 4 ; Jest `register` |
| D04 | Injection NoSQL sur le login | PASS (400) | PASS | Conservé : validation stricte des types | Rapport manuel |
| D05 | Injection via `sortBy` | FAIL (500 + message MongoDB) | PASS | Corrigé : liste blanche `src/utils/sort.js` | Jest `sort-injection` |
| D06 | Messages d'erreur | PASS (404 générique) | PASS | Conservé : gestion centralisée des erreurs | Rapport manuel ; ZAP |
| D07 | Contrôle d'accès par portefeuille client | FAIL (200 + données d'un autre agent) | PASS (403) | Corrigé : `src/utils/access.js` | Burp captures 1 et 3 ; Jest `portfolio-isolation` |
| D08 | Tentatives répétées de connexion | FAIL (pas de 429 après 11 tentatives) | PASS | Corrigé : `src/middleware/rateLimit.js` | Jest `rate-limit` |
