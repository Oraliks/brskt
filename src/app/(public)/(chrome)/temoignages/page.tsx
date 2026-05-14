import type { Metadata } from 'next';
import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { Quote } from 'lucide-react';
import { db } from '@/lib/db';
import { testimonials, users } from '@/lib/db/schema';
import { Section, SectionHeader } from '@/components/shared/section';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Témoignages',
  description:
    'Ce que disent les membres de la formation et du groupe VIP Telegram Boursikotons.',
};

export const dynamic = 'force-dynamic';

interface PublishedRow {
  id: string;
  body: string;
  createdAt: Date;
  userName: string | null;
  userTelegramUsername: string | null;
  userTelegramPhotoUrl: string | null;
}

export default async function TestimonialsPage() {
  const rows: PublishedRow[] = await db
    .select({
      id: testimonials.id,
      body: testimonials.body,
      createdAt: testimonials.createdAt,
      userName: users.name,
      userTelegramUsername: users.telegramUsername,
      userTelegramPhotoUrl: users.telegramPhotoUrl,
    })
    .from(testimonials)
    .leftJoin(users, eq(testimonials.userId, users.id))
    .where(eq(testimonials.status, 'published'))
    .orderBy(desc(testimonials.createdAt))
    .limit(60);

  const botUsername = process.env.TELEGRAM_BOT_USERNAME;

  return (
    <Section className="pt-24">
      <SectionHeader
        eyebrow="Ils en parlent"
        title="Témoignages"
        description="Avis envoyés par les membres directement via le bot Telegram. On les valide à la main."
      />

      {rows.length === 0 ? (
        <div className="mt-10 max-w-xl mx-auto glass rounded-[var(--radius-lg)] p-8 text-center">
          <p className="text-sm text-[var(--color-text-dim)]">
            Aucun témoignage publié pour le moment. Reviens bientôt.
          </p>
        </div>
      ) : (
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
          {rows.map((t) => (
            <TestimonialCard key={t.id} t={t} />
          ))}
        </div>
      )}

      <div className="mt-12 text-center max-w-xl mx-auto space-y-3">
        <p className="text-sm text-[var(--color-text-dim)]">
          Tu fais partie du programme et tu veux partager ton retour ?
        </p>
        {botUsername ? (
          <Button asChild variant="secondary">
            <Link
              href={`https://t.me/${botUsername}?start=temoignage`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ouvrir le bot → /temoignage
            </Link>
          </Button>
        ) : (
          <p className="text-xs text-[var(--color-text-faint)]">
            Utilise la commande <code>/temoignage</code> dans notre bot Telegram.
          </p>
        )}
      </div>
    </Section>
  );
}

function TestimonialCard({ t }: { t: PublishedRow }) {
  const handle = t.userTelegramUsername;
  return (
    <article className="glass rounded-2xl p-5 flex flex-col gap-3 h-full">
      <Quote className="h-4 w-4 text-[var(--color-accent-hover)] opacity-70" />
      <p className="text-sm leading-relaxed text-[var(--color-text)] flex-1 whitespace-pre-line">
        {t.body}
      </p>
      <div className="flex items-center gap-2.5 pt-1 border-t border-[var(--color-border)]">
        {t.userTelegramPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={t.userTelegramPhotoUrl}
            alt=""
            className="h-7 w-7 rounded-full flex-shrink-0"
          />
        ) : (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 text-xs font-medium text-white flex-shrink-0">
            {(t.userName ?? '?').charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <div className="text-xs font-medium truncate">
            {t.userName ?? 'Membre'}
          </div>
          {handle ? (
            <a
              href={`https://t.me/${handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-mono text-[var(--color-accent-hover)] hover:underline"
            >
              @{handle}
            </a>
          ) : (
            <span className="text-[11px] text-[var(--color-text-faint)]">
              membre Telegram
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
