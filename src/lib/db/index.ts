import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * DB Drizzle, initialisée à la demande pour ne pas crasher au load des
 * modules pendant le build de Next (où DATABASE_URL n'est pas requis).
 *
 * Toute opération qui touche réellement la DB échouera sans DATABASE_URL.
 */

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let cached: DrizzleDb | null = null;

function init(): DrizzleDb {
  if (cached) return cached;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  // Disable prefetch as it is not supported for "Transaction" pool mode (Supabase)
  const client = postgres(connectionString, { prepare: false });
  cached = drizzle(client, { schema, casing: 'snake_case' });
  return cached;
}

export const db = new Proxy({} as DrizzleDb, {
  get(_, prop) {
    const instance = init();
    return Reflect.get(instance as never, prop);
  },
}) as DrizzleDb;

export type DB = DrizzleDb;
export * from './schema';
