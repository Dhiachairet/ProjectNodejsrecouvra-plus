#!/usr/bin/env bash
# Runs one k6 measurement against a freshly seeded database and records CPU / memory at the same time.
#
#   perf/mesure.sh <label> <load|stress> <single|cluster> [extra k6 -e options]
#
#   perf/mesure.sh avant-single load single     # one Node process  (npm run start:single)
#   perf/mesure.sh apres-cluster load cluster   # one process per core (npm start)
#
# Outputs in test/evidence/6.2/:
#   k6-<script>-<label>.{txt,json,html}   k6 console, summary, web dashboard
#   k6-stress-<label>-points.csv.gz, -par-palier.tsv   raw points and per-30 s table (stress only)
#   cpu-mem-api-<script>-<label>.txt              top, every 5 s, every Node process of the API
#   cpu-mem-mongo-<script>-<label>.txt            docker stats of the MongoDB container, every ~5 s
# Prerequisites: MongoDB in the Docker container $MONGO_CONTAINER (default recouvra-mongo),
# frontend built (npm run frontend:build), port 3000 free, docker image grafana/k6.
set -euo pipefail
cd "$(dirname "$0")/.."

LABEL=$1; SCRIPT=$2; MODE=$3; shift 3
OUT=test/evidence/6.2
MONGO_CONTAINER=${MONGO_CONTAINER:-recouvra-mongo}
case $SCRIPT in load) SAMPLES=26 ;; stress) SAMPLES=62 ;; *) echo "load or stress"; exit 1 ;; esac
case $MODE in single) ENTRY=src/server.js ;; cluster) ENTRY=src/cluster.js ;; *) echo "single or cluster"; exit 1 ;; esac

npm run seed > /dev/null
node "$ENTRY" > "/tmp/recouvra-$LABEL.log" 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
until curl -sf http://localhost:3000/health > /dev/null; do sleep 0.5; done
sleep 2

PIDS=$(pgrep -d, -f "node .*src/(server|cluster)\.js$")
top -b -d 5 -n $SAMPLES -p "$PIDS" > "$OUT/cpu-mem-api-$SCRIPT-$LABEL.txt" &
TOP=$!
( for _ in $(seq $SAMPLES); do docker stats "$MONGO_CONTAINER" --no-stream --format '{{.Name}} CPU={{.CPUPerc}} MEM={{.MemUsage}}'; sleep 4; done ) \
  > "$OUT/cpu-mem-mongo-$SCRIPT-$LABEL.txt" &
DSTATS=$!

docker run --rm --network host -u "$(id -u):$(id -g)" -v "$PWD/perf:/perf:ro" -v "$PWD/$OUT:/out" \
  -e K6_WEB_DASHBOARD=true -e K6_WEB_DASHBOARD_EXPORT="/out/k6-$SCRIPT-$LABEL.html" "$@" \
  grafana/k6 run --quiet \
  $( [ "$SCRIPT" = stress ] && echo "--out csv=/out/k6-stress-$LABEL-points.csv.gz" ) "/perf/$SCRIPT.js" \
  > "$OUT/k6-$SCRIPT-$LABEL.txt" 2>&1 || true   # k6 exits 99 when a threshold fails: still a result

kill $TOP $DSTATS 2>/dev/null || true
echo "mode=$MODE entry=$ENTRY node_processes=$(echo "$PIDS" | tr ',' '\n' | wc -l)" >> "$OUT/k6-$SCRIPT-$LABEL.txt"
grep -E "http_req_duration\.\.|http_req_failed\.\.|http_reqs\.\." "$OUT/k6-$SCRIPT-$LABEL.txt"
if [ "$SCRIPT" = stress ]; then node perf/analyse-stress.mjs "$OUT/k6-stress-$LABEL-points.csv.gz" | tee "$OUT/k6-stress-$LABEL-par-palier.tsv"; fi
