/**
 * Promeut un utilisateur au rôle admin.
 *
 * Usage:
 *   pnpm tsx scripts/promote-admin.ts <email-ou-telegram-id>
 */

import { config as loadEnv } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, or } from 'drizzle-orm';
import * as schema from '../src/lib/db/schema';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

async function main() {
  const identifier = process.argv[2];
  if (!identifier) {
    console.error('Usage: pnpm tsx scripts/promote-admin.ts <email-ou-telegram-id>');
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL manquant');
    process.exit(1);
  }

  const client = postgres(url, { prepare: false });
  const db = drizzle(client, { schema });

  // Cherche par email OU telegramId
  const telegramId = /^\d+$/.test(identifier) ? Number(identifier) : null;

  const user = await db.query.users.findFirst({
    where: telegramId
      ? or(
          eq(schema.users.email, identifier),
          eq(schema.users.telegramId, telegramId)
        )
      : eq(schema.users.email, identifier),
  });

  if (!user) {
    console.error(`Aucun user trouvé pour "${identifier}"`);
    await client.end();
    process.exit(1);
  }

  await db
    .update(schema.users)
    .set({ role: 'admin', updatedAt: new Date() })
    .where(eq(schema.users.id, user.id));

  console.log(`✓ ${user.name} (${user.email ?? user.telegramUsername ?? user.telegramId}) est maintenant admin.`);

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
