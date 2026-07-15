import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const runtimeDir = path.join(projectRoot, 'output', 'playwright', 'runtime');

rmSync(runtimeDir, { force: true, recursive: true });
mkdirSync(runtimeDir, { recursive: true });

process.env.NANKE_DATA_DIR = runtimeDir;
process.env.NANKE_DB_PATH = path.join(runtimeDir, 'nanke-e2e.db');

const { createServer } = await import('vite');
const server = await createServer({
  clearScreen: false,
  server: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true
  }
});

await server.listen();
server.printUrls();

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await server.close();
  process.exit(0);
}

process.once('SIGINT', () => void stop());
process.once('SIGTERM', () => void stop());
