/**
 * Applique les migrations Drizzle en bypass du prompt interactif.
 *
 * Usage:
 *   pnpm tsx scripts/apply-migration.ts
 */

import { config as loadEnv } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL manquant');
    process.exit(1);
  }
  console.log('Applying migrations from ./drizzle …');
  const client = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('✓ Migrations applied');
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
