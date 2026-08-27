import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createApp } from './app.mjs';
import { EmissionsCalibrationService } from './domain.mjs';
import { AtomicStore } from './store.mjs';

export function parsePort(value) {
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,4}$/.test(value)) throw new Error('PORT must be an integer between 1 and 65535.');
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535.');
  return port;
}
export function startServer({ port = parsePort(process.env.PORT ?? '65092'), dataPath } = {}) {
  const store = new AtomicStore(dataPath ?? resolve(process.cwd(), 'data', 'emissions-calibration.json'));
  const server = createApp(new EmissionsCalibrationService(store)).listen(port, '0.0.0.0', () => process.stdout.write(`Industrial air emissions calibration service listening on 0.0.0.0:${port}\n`));
  return server;
}
const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? resolve(process.argv[1]) : '';
if (currentFile === invokedFile) {
  const server = startServer();
  let closing = false;
  const shutdown = (signal) => {
    if (closing) return;
    closing = true;
    process.stdout.write(`Received ${signal}; closing service.\n`);
    server.close((error) => { if (error) { process.stderr.write(`Service shutdown failed: ${error.message}\n`); process.exitCode = 1; } });
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}
