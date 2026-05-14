/**
 * Seed initial : crée les 2 formations et le toggle IronFX en mode manual.
 *
 * Usage:
 *   tsx scripts/seed.ts
 */

import { config as loadEnv } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/lib/db/schema';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { schema });

  console.log('Seeding formations...');

  await db
    .insert(schema.formations)
    .values([
      {
        title: 'Formation Trading à Distance',
        slug: 'formation-distance',
        mode: 'remote',
        description:
          '7 jours en visio privée. 5 modules à acquérir (Graphiques, Fondamental, Matières premières, Psychologie, Money management). On reste jusqu\'à ce que tout soit assimilé.',
        priceEur: '1500',
        durationDays: 7,
        active: true,
      },
      {
        title: 'Formation Trading à Dubaï',
        slug: 'formation-dubai',
        mode: 'onsite',
        description:
          '7 jours en face-à-face à Dubaï. 5 modules à acquérir (Graphiques, Fondamental, Matières premières, Psychologie, Money management). Setup pro sur place. Vol A/R non inclus.',
        priceEur: '3500',
        durationDays: 7,
        active: true,
      },
    ])
    .onConflictDoNothing();

  console.log('Seeding IronFX mode (default: manual)...');

  await db
    .insert(schema.appSettings)
    .values({
      key: 'ironfx_mode',
      value: { mode: 'manual' },
    })
    .onConflictDoNothing();

  console.log('✓ Seed complete');
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
