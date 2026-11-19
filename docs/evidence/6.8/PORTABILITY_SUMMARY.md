# Portability test: ISO/IEC 25010, 6.8 Portability

Run on 2026-11-19 · branch `s1/quality-portability`

## What is tested

- **Installability.** Can someone start the app from the repository alone, with the documented commands, and how long does it take?
- **Adaptability.** Does the same code run unchanged on different systems (Windows with Docker Desktop, Linux)? Can the settings that depend on the machine (port, secret) change without editing code?

The test follows task 5 of the [team plan](../../TEAM_PLAN.md):
1. Make a fresh clone.
2. Run `docker compose up`.
3. Run a script that checks `/health` and signs in: [scripts/smoke-test.js](../../../scripts/smoke-test.js).
   - It also checks that the React app and the Swagger docs are served.
   - It checks that `/api/stats` answers with the demo data.
   - It fails if any of these 5 checks fails.

The Docker setup is described in "Run with Docker" in the [README](../../../README.md).

## Environments

| # | Machine | How | Result | Evidence |
|---|---|---|---|---|
| 1 | Windows 11 Pro, Docker Desktop (Engine 28.5.2, Compose 2.40.3) | From the working folder, image built without cache | 5/5 checks passed | [log](docker-run-windows-2026-11-19.txt) |
| 2 | Same Windows machine | **Fresh clone from GitHub** into an empty folder (commit `5206af2`), image built without cache, base image checked again on Docker Hub | 5/5 checks passed | [log](portability-clean-clone-2026-11-19.txt) |
| 3 | GitHub Actions `ubuntu-latest` | Every push: a new Linux virtual machine that has never run the project clones the branch, builds, starts, seeds and runs the smoke test | 3 of 3 runs passed | [CI runs](ci-runs-2026-11-19.md) |
| 4 | A teammate's computer that never ran the project | Follow "Run with Docker" in the README | Result not available yet | (see below) |

## Fresh clone in detail (run 2)

| Step | Result | Time |
|---|---|---|
| `git clone` | No `.env`, `node_modules` or `frontend/dist` in the clone | 1 s |
| `docker compose up` without `JWT_SECRET` | Refused with a clear message, exit code 1, nothing started | |
| Build without cache (`--no-cache --pull`) | React build and API in one image of 291 MB | 19 s |
| `docker compose up -d --wait` | MongoDB and the app both healthy | 5 s |
| Seed | 5 users, 150 clients, 2,000 invoices, 1,428 collection actions | 4 s |
| Smoke test | **5/5 checks passed** | under 1 s |
| Inside the container | Runs as user `node`, not root; Node 24.22.3, Alpine 3.24.4, `NODE_ENV=production` | |
| Restart the app container | Data still there, 5/5 checks passed again | |
| `docker compose down -v` | 0 containers and 0 volumes left | 2 s |

- In the build log, only the two `WORKDIR` steps show `CACHED`. Every `COPY`, both `npm ci` and the Vite build ran again.
- The `node:24-alpine` and `mongo:8` images were already on this machine, so the times above do not include downloading them.
- The CI runs do include that download, because every job starts on an empty machine. Over the 3 runs, "Build and start the stack" took 20 to 28 s and the whole Docker job 29 to 40 s (see the [CI runs](ci-runs-2026-11-19.md)).

## Adaptability checks

- **Port.** It is chosen with `APP_PORT`, with no code change. Port 3300 was used in run 1 and 3400 in run 2.
- **Secret.** `JWT_SECRET` is required and comes from the environment or `.env`. It is never stored in the repository or the image (`.dockerignore` excludes every `.env` file). CI makes a new random one for each run.
- **Database.** MongoDB runs in its own container and does not publish a port. It therefore cannot clash with a MongoDB already installed on the machine. Runs 1 and 2 ran next to other containers on the same Docker host without conflict.
- **Operating systems.** The same `Dockerfile` and `docker-compose.yml` worked on Windows (Docker Desktop, linux/amd64) and on Ubuntu (GitHub Actions).

## Limits and requirements

- **Docker Engine 25 or newer** (for example a recent Docker Desktop), because the healthchecks use `start_interval`.
- **`mongo:8` needs a 64-bit CPU with AVX.** This is MongoDB's own requirement, so some very old processors and some virtual machines cannot run it.
- **Not tested:** ARM computers such as Apple Silicon Macs. Both base images are published for arm64, but no run was made.
- **Running without Docker** (Node.js and MongoDB installed by hand, as in the README "Installation") is checked by Student 4 on a fresh machine, as the team plan says.

## Run 4: repeat on another computer

Any teammate whose computer has never run the project can do this. It takes about 10 minutes. With Docker and git installed:

```bash
git clone --branch s1/quality-portability https://github.com/Dhiachairet/ProjectNodejsrecouvra-plus.git
cd ProjectNodejsrecouvra-plus
cp .env.example .env          # then set JWT_SECRET to a long random value
docker compose up -d --build --wait
docker compose run --rm seed
node scripts/smoke-test.js    # needs Node 18+; otherwise open http://localhost:3000 and sign in as admin@recouvra.tn
docker compose down -v
```

Save the terminal output as `docs/evidence/6.8/docker-run-<os>-<date>.txt`. Remove any personal folder names from it first. Then add a row to the table above.

## Verdict

| Requirement | Result | Status |
|---|---|---|
| Installs from a fresh clone with the documented commands | Windows (fresh clone) and Ubuntu (CI) | Conforms |
| Starts with one command and is healthy in under 3 minutes | 5 s on Windows; 20 to 28 s on a new CI machine, including the image downloads and the build | Conforms |
| Works on a machine that has never run the project | 3 of 3 CI runs on new Ubuntu virtual machines passed | Conforms |
| Machine-specific settings change without code changes | Port and secret from the environment; MongoDB isolated | Conforms |
| Checked on a teammate's computer | Not run yet | Result not available yet |
