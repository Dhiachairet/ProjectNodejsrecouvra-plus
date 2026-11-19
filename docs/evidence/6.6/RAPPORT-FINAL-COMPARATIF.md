# Rapport de sécurité — Comparatif Avant/Après correction

Projet : Recouvra Plus. Toutes les données proviennent des fichiers de `docs/evidence/6.6/` (chemin cité à chaque fois). Aucun chiffre n'est estimé.

## 1. Résumé exécutif

| Catégorie | Avant | Après | Source |
|---|---|---|---|
| Jest (tests de sécurité, 8 suites) | 67 tests en échec / 198 | 0 en échec / 198 | `jest-tests/security-test-before--2026-11-18.txt`, `jest-tests/security-test-after--2026-11-18.txt` |
| Manuel D01-D08 | Non disponible — à régénérer | Non disponible — à régénérer | aucun fichier D01-D08 présent |
| SAST ESLint security | 2 erreurs, 4 warnings | **0 erreur, 0 warning** (après correction ESLint du 2026-11-19) | `sast/eslint-security-before-2026-11-17.json`, `sast/eslint-security-after-2026-11-19.json` |
| SCA backend (npm audit) | 16 (2 crit., 9 high, 4 mod., 1 low) | 2 (0 crit., 0 high, 2 mod. ; 0 en production) | `sca/npm-audit-backend-before-2026-11-17.txt`, `sca/npm-audit-backend-after-qs-2026-11-19.txt` |
| SCA frontend (npm audit) | 5 (high) | 0 | `sca/npm-audit-frontend-before-2026-11-17.txt`, `sca/npm-audit-frontend-after-2026-11-18.txt` |
| DAST ZAP baseline (H/M/L/I) | 0 / 3 / 5 / 3 | 0 / 2 / 2 / 3 | `dast/baseline-*` |
| DAST ZAP full | 0 / 5 / 5 / 4 | 0 / 3 / 2 / 4 | `dast/full-*` |
| DAST ZAP API authentifié | 0 / 1 / 4 / 5 | 0 / 0 / 1 / 4 | `dast/api-auth-*` |

## 2. Tests manuels D01-D08

**Non disponible — à régénérer.** Le dossier `manual-tests/` ne contient aucun fichier D01-D08 (ni avant, ni après). Il contient seulement des rapports Jest d'access-control (voir §3) : `access-control-tests-before-fixes-2026-11-17.json`, `access-control-tests-after-fixes-2026-11-17.json`, `access-control-tests-report.md`, `rapport-avant-apres-correction.md`.

| ID | Test | Résultat Avant | Résultat Après | Statut |
|---|---|---|---|---|
| D01-D08 | — | Non disponible — à régénérer | Non disponible — à régénérer | — |

## 3. Tests automatisés Jest+Supertest

### 3.1 Run complet (8 suites) — `jest-tests/security-test-*--2026-11-18.txt`

| Mesure | Avant | Après |
|---|---|---|
| Suites | 8 (7 en échec, 1 OK : `auth-token`) | 8 OK |
| Tests | 198 : 131 pass / 67 fail | 198 : 198 pass / 0 fail |

Les fichiers .txt ne donnent pas les passes par fichier pour ce run, seulement les échecs.

| Fichier de test | Avant (échecs) | Après |
|---|---|---|
| `auth-token` | 0 | OK |
| `headers-cors` | 10 | OK |
| `password-policy` | 6 | OK |
| `portfolio-isolation` | 9 | OK |
| `rate-limit` | 2 | OK |
| `register` | 7 | OK |
| `role-matrix` | 6 | OK |
| `sort-injection` | 27 | OK |
| **Total** | **67** | **0** |

Tests en échec « avant » (= comportement vulnérable prouvé) :
- `headers-cors` : 3 en-têtes Helmet + 7 tests CORS.
- `password-policy` : 6 rejets de mots de passe faibles.
- `portfolio-isolation` : lecture client, factures du client, paiements d'une facture, dossier de recouvrement, actions d'une facture, actions d'un client, modification facture, annulation facture, enregistrement paiement.
- `rate-limit` : 429 à la 11e tentative ; protection active en production.
- `register` : ignore `role: admin`, ignore `role: manager`, token après tentative d'escalade, création admin par agent/manager, création manager par agent, token invalide.
- `role-matrix` : 6 lectures « refusées à un agent » (client, factures, paiements, dossier, actions facture, actions client).
- `sort-injection` : 27 (clients/collections/invoices × `$where`, `$natural`, `__proto__`, `constructor`, `password`, champ inconnu, `sortBy[$ne]`, sortBy répété, order invalide).

### 3.2 Run antérieur (4 suites, 17 nov.) — `manual-tests/access-control-tests-{before,after}-fixes-2026-11-17.json` (JSON lisible)

| Fichier | Avant (pass/fail) | Après (pass/fail) |
|---|---|---|
| `auth-token.test.js` | 19 / 0 | 19 / 0 |
| `role-matrix.test.js` | 74 / 6 | 80 / 0 |
| `portfolio-isolation.test.js` | 14 / 9 | 23 / 0 |
| `register.test.js` | 4 / 7 | 11 / 0 |
| **Total** | 111 / 22 | 133 / 0 |

## 4. SAST (ESLint security)

Sources : `sast/eslint-security-before-2026-11-17.json` (33 fichiers), `sast/eslint-security-after-2026-11-19.json` (36 fichiers, commande `npx eslint src frontend/src`). Le run intermédiaire `sast/eslint-security-after-2026-11-18.json` (2 erreurs, 4 warnings) est conservé : il précède la correction ESLint.

| | Avant | Après |
|---|---|---|
| Erreurs | 2 | 0 |
| Warnings | 4 | 0 |

Corrections appliquées :
- `no-unused-vars` (`errorHandler.js`) : `next` conservé (signature à 4 paramètres) et utilisé : `if (res.headersSent) return next(err)`.
- `react-hooks/exhaustive-deps` (`frontend/src/api.js`) : plugin `eslint-plugin-react-hooks` installé et configuré dans `eslint.config.js` ; `eslint-disable` supprimé ; dépendances de `useApi` corrigées (`path`, `queryKey`, `version`).
- `security/detect-object-injection` : `useForm.js` (lecture limitée aux propriétés propres) et `collectionAction.workflow.js` (recherche via `Map`).
- `security/detect-unsafe-regex` : regex d'email (risque ReDoS) de `Client.js` et `User.js` remplacée par `isValidEmail` (`src/utils/email.js`, temps linéaire). Équivalence vérifiée sur 400 000 chaînes aléatoires (0 divergence) ; tests dans `tests/security/email-validation.test.js`.

Aucune règle désactivée. Hors périmètre de ce rapport : 24 warnings `detect-object-injection` subsistent dans `scripts/seed.js` et `tests/` (non analysés par la commande ci-dessus).

Tests après correction : `jest-tests/security-test-after-eslint-2026-11-19.txt` (`npm run test:security`) : 9 suites, 227 tests OK ; `npm test` complet : 10 suites, 233 tests OK.

Conclusion : les 6 constats SAST sont corrigés, aucun constat introduit par le nouveau code (36 fichiers analysés).

## 5. SCA (npm audit)

### Backend — `sca/npm-audit-backend-before-2026-11-17.txt` / `sca/npm-audit-backend-after-qs-2026-11-19.txt`

| Sévérité | Avant | Après |
|---|---|---|
| Critical | 2 | 0 |
| High | 9 | 0 |
| Moderate | 4 | 2 |
| Low | 1 | 0 |
| **Total** | **16** | **2** |

Avant : paquets `mongoose` et `proxy-addr` (critical), `body-parser`, `joi`, `path-to-regexp`, `qs`, `minimatch`, `picomatch`, `form-data`, `ip-address`, `js-yaml`, `brace-expansion`, `browserslist`, `baseline-browser-mapping`, etc.
Après : seules restent `minimatch` (GHSA-g3hv-75wg-m249) et `nodemon` qui en hérite, deux vulnérabilités moderate d'outillage de dev. `npm audit --omit=dev` : **0 vulnérabilité en production**.

Correctif `qs` (2026-11-19) : `"overrides": { "qs": "^6.17.1" }` dans `package.json` ; `npm ls qs` montre qs 6.17.1 pour express, body-parser et supertest/superagent/formidable. Cela a supprimé les vulnérabilités `qs` et `picomatch` (et leurs propagations jest/chokidar), d'où 39 → 2. L'ancien run `sca/npm-audit-backend-after-2026-11-17.txt` (39) est conservé comme état intermédiaire.

Reste : `minimatch` via `nodemon` ; le correctif proposé par npm (`npm audit fix --force`, nodemon@3.1.11) est un changement cassant, non appliqué, dev uniquement.

### Frontend

⚠️ `sca/npm-audit-frontend-after-2026-11-17.txt` est identique au « avant » (périmé) : ignoré. Utilisé : `sca/npm-audit-frontend-after-2026-11-18.txt`.

| Sévérité | Avant (`npm-audit-frontend-before-2026-11-17.txt`) | Après |
|---|---|---|
| Critical | 0 | 0 |
| High | 5 (picomatch, fdir, tinyglobby, vite, @vitejs/plugin-react) | 0 |
| Moderate / Low | 0 | 0 |

### OWASP Dependency-Check — `sca/dependency-check-2026-11-17.html` (v13.0.0)
- Avant : Non disponible (un seul scan ; `dependency-check-after-2026-11-17.html` est octet pour octet identique).
- Résultat unique : 5 dépendances vulnérables, 8 vulnérabilités : formidable 2.1.5 (LOW 1), minimatch 10.2.6 (MODERATE 1), picomatch 2.3.2 (HIGH 1), picomatch 4.0.7 (HIGH 1), qs 6.14.3 (MEDIUM 4).
- `sca/fiche-B-dependances.md` : absent.

## 6. DAST (ZAP)

« Systemic » = ZAP ne donne pas de nombre d'instances.

### 6.1 Baseline — `dast/baseline-before-2026-11-17.{html,json}`, `dast/baseline-after-2026-11-18.{html,json}` (JSON cohérents avec HTML)

| Risque | Avant | Après |
|---|---|---|
| High | 0 | 0 |
| Medium | 3 | 2 |
| Low | 5 | 2 |
| Info | 3 | 3 |

| Alerte | Risque | Avant | Après |
|---|---|---|---|
| CSP Header Not Set | Medium | 3 | — |
| Missing Anti-clickjacking Header | Medium | 2 | — |
| Cross-Domain Misconfiguration | Medium | 5 | — |
| CSP: Wildcard Directive | Medium | — | 2 |
| CSP: style-src unsafe-inline | Medium | — | 3 |
| COEP Header Missing/Invalid | Low | 3 | 3 |
| COOP Header Missing/Invalid | Low | 3 | — |
| Permissions Policy Header Not Set | Low | 4 | 4 |
| X-Powered-By leak | Low | 5 | — |
| X-Content-Type-Options Missing | Low | 5 | — |
| Suspicious Comments / Modern Web App / Storable but Non-Cacheable | Info | 1 / 3 / 5 | 1 / 3 / 5 |

(Après : valeurs Info identiques à avant ; « same 3 » relevé dans le rapport.)

### 6.2 Full scan — `dast/full-before-2026-11-17.html`, `dast/full-after-2026-11-18.html`

| Risque | Avant | Après |
|---|---|---|
| High | 0 | 0 |
| Medium | 5 | 3 |
| Low | 5 | 2 |
| Info | 4 | 4 |

| Alerte | Risque | Avant | Après |
|---|---|---|---|
| CORS Misconfiguration | Medium | Systemic | — |
| CSP Header Not Set | Medium | 4 | — |
| Cross-Domain Misconfiguration | Medium | Systemic | — |
| Missing Anti-clickjacking Header | Medium | 4 | — |
| HTTP Only Site | Medium | 1 | 1 |
| CSP: Wildcard Directive | Medium | — | 4 |
| CSP: style-src unsafe-inline | Medium | — | 4 |
| COEP | Low | 4 | 4 |
| COOP | Low | 4 | — |
| Permissions Policy | Low | 5 | 5 |
| X-Powered-By | Low | Systemic | — |
| X-Content-Type-Options | Low | Systemic | — |
| Suspicious Comments, Modern Web App, Storable but Non-Cacheable, User Agent Fuzzer | Info | 1, 4, Systemic, Systemic | idem |

### 6.3 API authentifié — `dast/api-auth-before-2026-11-17.html`, `dast/api-auth-after-2026-11-18.html`

| Risque | Avant | Après |
|---|---|---|
| High | 0 | 0 |
| Medium | 1 | 0 |
| Low | 4 | 1 |
| Info | 5 | 4 |

| Alerte | Risque | Avant | Après |
|---|---|---|---|
| Cross-Domain Misconfiguration | Medium | Systemic | — |
| Server Error response code | Low | 1 | — |
| X-Powered-By | Low | Systemic | — |
| X-Content-Type-Options | Low | 5 | — |
| Unexpected Content-Type | Low | 5 | 5 |
| Client Error response code | Info | 57 | 59 |
| Authentication Request Identified | Info | 1 | 1 |
| Sensitive Information in URL | Info | 1 | 1 |
| Non-Storable Content | Info | Systemic | Systemic |
| Session Management Response | Info | 1 | — |

`dast/fiche-A-alertes-zap.md` : absent.

## 7. Burp Suite (preuves manuelles)

Le dossier `burp/` est **vide** : **Non disponible — à régénérer**. Captures attendues :

| Fichier attendu | Signification | État |
|---|---|---|
| `capture-1-idor-avant.png` | Agent lit le client d'un autre agent (IDOR, GET `/api/clients/:id`) avant correction | Non disponible |
| `capture-2-escalade-avant.png` | `POST /api/auth/register` avec `role: admin` accepté avant correction | Non disponible |
| `capture-3-idor-apres.png` | Même requête IDOR refusée (403/404) après correction | Non disponible |
| `capture-4-escalade-apres.png` | Inscription forcée au rôle `agent` après correction | Non disponible |

Preuve de substitution automatisée : tests Jest `portfolio-isolation` et `register` (§3).

## 8. Classement OWASP Top 10 2021

| Catégorie | Faille trouvée | Outil | Statut | Preuve |
|---|---|---|---|---|
| A01 Broken Access Control | `/register` accepte `role` | Jest | Corrigé | `jest-tests/security-test-{before,after}--2026-11-18.txt` (`register`) |
| A01 | 8 routes sans contrôle de portefeuille | Jest | Corrigé | idem (`portfolio-isolation`, `role-matrix`) |
| A03 Injection | `sortBy` non filtré | Jest | Corrigé | idem (`sort-injection`, 27 échecs → 0) |
| A05 Security Misconfiguration | En-têtes manquants (CSP, anti-clickjacking, nosniff, X-Powered-By) | ZAP, Jest | Corrigé | `dast/baseline-*`, `dast/full-*`, `dast/api-auth-*`, Jest `headers-cors` |
| A05 | CORS ouvert | ZAP, Jest | Corrigé | `dast/full-before-2026-11-17.html` (CORS Misconfiguration), Jest `headers-cors` |
| A05 | CSP `unsafe-inline` / Wildcard, COEP, Permissions-Policy | ZAP | Justifié (restant) | `dast/*-after-2026-11-18.html` |
| A05 | HTTP Only Site | ZAP full | Justifié (test sans TLS) | `dast/full-after-2026-11-18.html` |
| A07 Auth. Failures | Pas de limite sur `/login` | Jest | Corrigé | Jest `rate-limit` |
| A07 | Mot de passe de 6 caractères | Jest | Corrigé | Jest `password-policy` |
| A06 Vulnerable Components | Dépendances vulnérables | npm audit, Dependency-Check | Partiel : critical 2 → 0 ; frontend 5 → 0 ; backend 16 → 2 (dev uniquement) | `sca/*` |
| A02/A07 (doc) | JWT dans localStorage | Revue de code | Documenté, non corrigé | `docs/SECURITY.md` |

## 9. Conclusion

Calculs basés uniquement sur les chiffres ci-dessus :

| Indicateur | Avant → Après | Amélioration |
|---|---|---|
| Tests Jest en échec | 67 → 0 | 100 % |
| ZAP baseline (Medium+Low) | 8 → 4 | 50 % |
| ZAP full (Medium+Low) | 10 → 5 | 50 % |
| ZAP API (Medium+Low) | 5 → 1 | 80 % |
| npm audit frontend | 5 → 0 | 100 % |
| npm audit backend critical | 2 → 0 | 100 % |
| npm audit backend total | 16 → 2 | 87,5 % (0 en production) |
| ESLint | 6 → 0 | 100 % |

Alertes restantes et justification :
- **CSP `style-src 'unsafe-inline'` / Wildcard Directive** : CSP par défaut de Helmet (compatibilité Swagger/UI) ; à durcir par une CSP personnalisée.
- **COEP / Permissions-Policy** : non définis par défaut par Helmet ; à ajouter si requis.
- **HTTP Only Site** : environnement de test sans TLS ; à traiter au déploiement (HTTPS).
- **Dépendances backend** : `minimatch` (via `nodemon`, dev uniquement, 2 moderate) ; correctif cassant non appliqué. `qs` et `picomatch` corrigés (override `qs` 6.17.1). Dependency-Check (2026-11-17) n'a pas été relancé : ses constats qs/picomatch ne reflètent plus l'état actuel.
- **ESLint** : plus d'alerte sur `src` et `frontend/src` ; 24 warnings `detect-object-injection` restent dans `scripts/seed.js` et `tests/` (hors périmètre).
- **JWT en localStorage** : documenté ; migration cookies HttpOnly/Secure/SameSite non faite.

À régénérer pour un dossier complet : D01-D08 (avant/après), captures Burp (4), Dependency-Check « avant », fiches A et B, passes Jest par fichier.
