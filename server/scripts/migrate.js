import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

try {
  process.loadEnvFile?.(); // Node 20.12+ / 22: reads ./.env
} catch {
  /* no .env file, rely on real environment variables */
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is missing. Copy .env.example to .env and paste your Neon connection string.');
  process.exit(1);
}

const sql = await readFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'schema.sql'), 'utf8');
const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
  await client.query(sql);
  const t = await client.query("select table_name from information_schema.tables where table_schema='public' and table_name in ('users','sessions','records') order by 1");
  console.log('Schema applied. Tables:', t.rows.map((r) => r.table_name).join(', '));
} catch (e) {
  console.error('Migration failed:', e.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
