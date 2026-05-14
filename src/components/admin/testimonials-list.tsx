'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { adminModerateTestimonialAction } from '@/lib/actions/admin';
import { formatDate } from '@/lib/utils';

export interface TestimonialRow {
  id: string;
  body: string;
  status: 'pending' | 'published' | 'rejected';
  createdAt: Date;
  userName: string | null;
  userTelegramUsername: string | null;
  userTelegramPhotoUrl: string | null;
}

interface Props {
  items: TestimonialRow[];
  showActions?: boolean;
}

export function TestimonialsList({ items, showActions }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function moderate(testimonialId: string, action: 'publish' | 'reject') {
    start(async () => {
      const result = await adminModerateTestimonialAction({
        testimonialId,
        action,
      });
      if (result.success) {
        toast({
          title:
            action === 'publish'
              ? '✓ Témoignage publié'
              : '✓ Témoignage rejeté',
        });
        router.refresh();
      } else {
        toast({
          title: 'Erreur',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  }

  if (items.length === 0) {
    return (
      <div className="glass rounded-[var(--radius-lg)] p-10 text-center text-sm text-[var(--color-text-dim)]">
        Aucun témoignage dans cette catégorie.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((t) => (
        <article
          key={t.id}
          className="glass rounded-[var(--radius-lg)] p-4 flex gap-3"
        >
          {t.userTelegramPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={t.userTelegramPhotoUrl}
              alt=""
              className="h-8 w-8 rounded-full flex-shrink-0"
            />
          ) : (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 text-xs font-medium text-white flex-shrink-0">
              {(t.userName ?? '?').charAt(0).toUpperCase()}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <strong className="text-sm">{t.userName ?? 'Anonyme'}</strong>
              {t.userTelegramUsername && (
                <span className="text-xs font-mono text-[var(--color-text-dim)]">
                  @{t.userTelegramUsername}
                </span>
              )}
              <span className="text-[10px] text-[var(--color-text-faint)]">
                {formatDate(t.createdAt)}
              </span>
              <StatusBadge status={t.status} />
            </div>
            <p className="mt-1.5 text-sm text-[var(--color-text)] whitespace-pre-line leading-relaxed">
              {t.body}
            </p>
            {showActions && (
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  onClick={() => moderate(t.id, 'publish')}
                  disabled={pending}
                >
                  {pending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Publier
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => moderate(t.id, 'reject')}
                  disabled={pending}
                  className="text-rose-300 light:text-rose-700 hover:bg-rose-500/10"
                >
                  <X className="h-3.5 w-3.5" />
                  Rejeter
                </Button>
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: TestimonialRow['status'] }) {
  if (status === 'published') {
    return <Badge variant="success">Publié</Badge>;
  }
  if (status === 'rejected') {
    return <Badge variant="danger">Rejeté</Badge>;
  }
  return <Badge variant="warning">En attente</Badge>;
}
