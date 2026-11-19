// Production entry point (npm start): one server process per CPU core.
// Node runs JavaScript on a single thread, so a CPU-heavy request (bcrypt password hashing at
// login, ~130 ms) blocks every other request of that process. With several workers sharing the
// same port, the load is spread across cores (DEF-03, §6.2 performance).
// WEB_CONCURRENCY sets the number of workers; WEB_CONCURRENCY=1 behaves like a single process.
import cluster from 'node:cluster';
import os from 'node:os';

const workers = parseInt(process.env.WEB_CONCURRENCY, 10) || os.availableParallelism();

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid}: starting ${workers} worker(s)`);
  const listening = new Set();
  cluster.on('listening', (worker) => listening.add(worker.id));
  for (let i = 0; i < workers; i += 1) cluster.fork();

  // Replace a worker that crashed while serving. A worker that dies before it ever listened
  // (database unreachable, port taken...) would only crash again: stop everything instead.
  cluster.on('exit', (worker, code, signal) => {
    if (worker.exitedAfterDisconnect || signal === 'SIGINT' || signal === 'SIGTERM') return;
    if (!listening.has(worker.id)) {
      console.error(`Worker ${worker.process.pid} failed at startup (${signal || code}), stopping`);
      process.exit(1);
    }
    console.log(`Worker ${worker.process.pid} exited (${signal || code}), starting a new one`);
    cluster.fork();
  });
} else {
  await import('./server.js');
}
