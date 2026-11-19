#!/usr/bin/env bash
# Test de coexistence (ISO 25010 §6.3) : Recouvra+ partage la machine avec d'autres services
# sans conflit de port ni de données. Résultat écrit dans test/evidence/6.3/coexistence-<date>.txt
# Prérequis : MongoDB sur localhost:27017, base seedée, frontend construit, ports 3000-3002 et 3005 libres.
# Usage : test/coexistence.sh
set -uo pipefail
cd "$(dirname "$0")/.."
OUT=test/evidence/6.3/coexistence-$(date +%F).txt
LOGIN='{"email":"admin@recouvra.tn","password":"Password123!"}'
PIDS=()
cleanup() { for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null; done; wait 2>/dev/null; }
trap cleanup EXIT
wait_up() { for _ in $(seq 60); do curl -sf "localhost:$1/health" > /dev/null && return 0; sleep 0.5; done; return 1; }
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }

{
echo "# Test de coexistence (ISO 25010 §6.3) - $(date '+%F %T')"
echo "Machine : $(uname -sr), Node $(node -v), MongoDB 7 (Docker), $(nproc) cœurs"
echo "Mode de démarrage : npm start = cluster (un processus par cœur, src/cluster.js)"
echo

echo "## 1. Un autre service occupe un port (simulation : python3 -m http.server 3005)"
python3 -m http.server 3005 > /dev/null 2>&1 & PIDS+=($!)
sleep 1; echo "curl localhost:3005 -> $(code localhost:3005)"
echo

echo "## 2. Instance A de Recouvra+ sur 3000 (npm start)"
PORT=3000 node src/cluster.js > /dev/null 2>&1 & PIDS+=($!)
wait_up 3000; echo "curl localhost:3000/health -> $(code localhost:3000/health)"
echo

echo "## 3. Démarrage sur un port déjà occupé : PORT=3005 npm start (doit échouer sans gêner le service existant)"
PORT=3005 WEB_CONCURRENCY=1 timeout 20 node src/cluster.js 2>&1 | grep -E "EADDRINUSE|failed at startup" | head -2
echo "code de sortie : ${PIPESTATUS[0]} (≠ 0 attendu) ; service tiers toujours là : curl localhost:3005 -> $(code localhost:3005)"
echo

echo "## 4. Instance B : PORT=3001 npm start (même base)"
PORT=3001 WEB_CONCURRENCY=2 node src/cluster.js > /dev/null 2>&1 & PIDS+=($!)
wait_up 3001
echo "## 5. Instance C : PORT=3002 MONGODB_URI=.../recouvraplus_coexist npm start (autre base, même serveur Mongo)"
PORT=3002 WEB_CONCURRENCY=2 MONGODB_URI=mongodb://localhost:27017/recouvraplus_coexist node src/cluster.js > /dev/null 2>&1 & PIDS+=($!)
wait_up 3002
echo

echo "## 6. Tous les services répondent en même temps"
for u in 3005/ 3000/ 3001/ 3002/ 3000/api-docs/ 3001/api-docs/ 3002/api-docs/; do echo "curl localhost:$u -> $(code localhost:$u)"; done
echo

echo "## 7. Isolation des données : login admin sur chaque instance (3002 a une base vide -> 401 attendu)"
for p in 3000 3001 3002; do
  echo "port $p -> HTTP $(code -X POST "localhost:$p/api/auth/login" -H 'Content-Type: application/json' -d "$LOGIN")"
done
echo
echo "Services arrêtés à la fin du test."
} | tee "$OUT"
