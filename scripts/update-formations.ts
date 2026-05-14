/**
 * Met à jour les descriptions/duration des formations en DB.
 * Idempotent — peut être relancé.
 */

import { config as loadEnv } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../src/lib/db/schema';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
  const db = drizzle(client, { schema });

  await db
    .update(schema.formations)
    .set({
      description:
        "7 jours en visio privée. 5 modules à acquérir (Graphiques, Fondamental, Matières premières, Psychologie, Money management). On reste jusqu'à ce que tout soit assimilé.",
      durationDays: 7,
      updatedAt: new Date(),
    })
    .where(eq(schema.formations.slug, 'formation-distance'));

  await db
    .update(schema.formations)
    .set({
      description:
        '7 jours en face-à-face à Dubaï. 5 modules à acquérir (Graphiques, Fondamental, Matières premières, Psychologie, Money management). Setup pro sur place. Vol A/R non inclus.',
      durationDays: 7,
      updatedAt: new Date(),
    })
    .where(eq(schema.formations.slug, 'formation-dubai'));

  console.log('✓ Formations updated to 7 jours / 5 modules');
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
