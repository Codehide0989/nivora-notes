import { loadConfig } from './config.js';
import { createApp } from './app.js';
import { createMemoryStore } from './store/memory.js';

try {
  process.loadEnvFile?.();
} catch {
  /* no .env file: use real environment variables */
}

const config = loadConfig();
let store;
if (config.store === 'memory') {
  store = createMemoryStore({ maxRecordsPerUser: config.maxRecordsPerUser });
} else {
  const { createPostgresStore } = await import('./store/postgres.js');
  store = createPostgresStore({ databaseUrl: config.databaseUrl, maxRecordsPerUser: config.maxRecordsPerUser });
}

if (store.kind === 'memory') console.warn('[warn] STORE=memory: data is lost when the server restarts. Use only for testing.');
else {
  try {
    await store.ping();
    console.log('Connected to Postgres (Neon).');
  } catch (e) {
    console.error('Could not reach the database:', e.message);
    console.error('Check DATABASE_URL, and run "npm run db:migrate" once.');
    process.exit(1);
  }
}

const { server } = createApp({ config, store });
server.listen(config.port, () => console.log(`Nivora sync server listening on :${config.port}`));

const stop = () => {
  server.close(async () => {
    await store.close?.();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
