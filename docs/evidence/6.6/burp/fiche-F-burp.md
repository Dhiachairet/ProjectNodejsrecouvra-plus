# Fiche F — Preuves Burp Suite

Quatre captures Burp Suite (Repeater, cible `http://localhost:3000`, réponses datées du 18 nov. 2026) dans le dossier `burp/`.

| N° | Fichier | Test | OWASP | État | Résultat observé |
|---|---|---|---|---|---|
| 1 | `capture-1-idor-avant.png` | IDOR : agent lit le client d'un autre agent (GET `/api/clients/:id`), avant correction | A01 | Disponible | `200 OK`, données du client « Ahmed Bouazizi » |
| 2 | `capture-2-escalade-avant.png` | `POST /api/auth/register` avec `role: admin`, avant correction | A01 | Disponible | `success: true`, token, `"role":"admin"` |
| 3 | `capture-3-idor-apres.png` | Même requête IDOR, après correction | A01 | Disponible | `403 Forbidden`, « You can only view your own clients » |
| 4 | `capture-4-escalade-apres.png` | `POST /api/auth/register` avec `role: admin`, après correction | A01 | Disponible | compte créé avec `"role":"agent"` (rôle forcé) |

Preuves complémentaires : Jest `portfolio-isolation`, `role-matrix` et `register` (échecs avant, OK après).
