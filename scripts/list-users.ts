/**
 * Liste les utilisateurs avec leur ID Telegram et leur email.
 * Pratique pour identifier un user à promouvoir admin.
 */

import { config as loadEnv } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/lib/db/schema';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL manquant');

  const client = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(client, { schema });

  const users = await db.query.users.findMany({
    columns: {
      id: true,
      name: true,
      email: true,
      role: true,
      telegramId: true,
      telegramUsername: true,
    },
  });

  for (const u of users) {
    console.log(
      [
        u.role.padEnd(6),
        u.name?.padEnd(20),
        u.email?.padEnd(30) ?? '<no email>'.padEnd(30),
        u.telegramUsername ? '@' + u.telegramUsername : '',
        'tg:' + (u.telegramId ?? 'null'),
      ].join(' | ')
    );
  }
  console.log(`\nTotal: ${users.length}`);

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
