# Fiche A — Alertes ZAP (rapports « after »)

Sources : `dast/baseline-after-2026-11-18.html`, `dast/full-after-2026-11-18.html`, `dast/api-auth-after-2026-11-18.html` ; liste reprise de `RAPPORT-FINAL-COMPARATIF.md` §6. Une ligne par alerte unique (14).
Les colonnes V/F, OWASP et justification sont une analyse à valider par l'équipe, sauf mention de la source. « Systemic » = nombre d'instances non donné par ZAP.

| N° | Alerte ZAP | Risque | V/F | Catégorie OWASP | Correction ou justification |
|---|---|---|---|---|---|
| 1 | CSP: Wildcard Directive (baseline 2, full 4) | Medium | V | A05 Security Misconfiguration | Restant. CSP par défaut de Helmet (`app.use(helmet())`, `src/app.js`) ; à durcir par une CSP personnalisée. |
| 2 | CSP: style-src unsafe-inline (baseline 3, full 4) | Medium | V | A05 | Restant. Même cause : CSP par défaut de Helmet. Durcissement possible par CSP personnalisée. |
| 3 | HTTP Only Site (full 1) | Medium | V (lié à l'environnement) | A02 Cryptographic Failures / A05 | Justifié : scan fait en HTTP sans TLS (`host.docker.internal:3000`). À traiter par HTTPS au déploiement. |
| 4 | Cross-Origin-Embedder-Policy (COEP) manquant (baseline 3, full 4) | Low | V (faible) | A05 | Restant. Non défini par défaut par Helmet ; à ajouter si requis. |
| 5 | Permissions Policy Header Not Set (baseline 4, full 5) | Low | V (faible) | A05 | Restant. Non défini par défaut par Helmet ; à ajouter si requis. |
| 6 | Unexpected Content-Type (api-auth 5) | Low | À vérifier | A05 | Restant, non analysé en détail dans les données disponibles. |
| 7 | Information Disclosure — Suspicious Comments (baseline 1, full 1) | Info | À vérifier (probable faux positif) | A05 | Info seulement ; inchangé avant/après. |
| 8 | Modern Web App (baseline 3, full 4) | Info | F | — | Alerte informative (détection d'une application web moderne) ; aucune action. |
| 9 | Storable but Non-Cacheable Content (baseline 5, full Systemic) | Info | F | A05 | Info seulement ; inchangé avant/après. |
| 10 | User Agent Fuzzer (full Systemic) | Info | F | — | Alerte informative produite par le scan actif lui-même. |
| 11 | Non-Storable Content (api-auth Systemic) | Info | F | A05 | Info seulement ; comportement normal pour des réponses d'API. |
| 12 | Client Error response code (api-auth 59 ; 57 avant) | Info | F | — | Attendu : les tests d'accès refusés (401/403/404/400) génèrent ces codes. |
| 13 | Authentication Request Identified (api-auth 1) | Info | F | A07 Identification and Authentication Failures | Info : ZAP a identifié la requête de login. Protégée par rate limiting (10 / 15 min). |
| 14 | Sensitive Information in URL (api-auth 1) | Info | À vérifier | A04 / A07 | Inchangé avant/après (1). Source de l'URL concernée non analysée ici. |

## Alertes disparues après correction (rapports « before » 2026-11-17)

CSP Header Not Set, Missing Anti-clickjacking Header, CORS Misconfiguration, Cross-Domain Misconfiguration, COOP, X-Powered-By, X-Content-Type-Options, Server Error response code, Session Management Response → corrigées par Helmet, CORS restreint et `x-powered-by` désactivé (voir `RAPPORT-FINAL-COMPARATIF.md` §6).
