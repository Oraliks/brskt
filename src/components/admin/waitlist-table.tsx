import { formationWaitlist } from '@/lib/db/schema';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate } from '@/lib/utils';

type Entry = typeof formationWaitlist.$inferSelect;

interface Props {
  entries: Entry[];
}

export function WaitlistTable({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div className="glass rounded-[var(--radius-lg)] p-10 text-center text-sm text-[var(--color-text-dim)]">
        Personne en attente pour le moment.
      </div>
    );
  }

  return (
    <div className="glass rounded-[var(--radius-lg)] overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Format</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead className="text-right">Inscrit·e le</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => (
            <TableRow key={e.id}>
              <TableCell>
                <Badge variant={e.mode === 'onsite' ? 'gold' : 'default'}>
                  {e.mode === 'onsite' ? 'Présentiel' : 'Distance'}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">
                <div className="font-medium">{e.firstName ?? '—'}</div>
                <a
                  href={`mailto:${e.email}`}
                  className="text-xs text-[var(--color-accent-hover)] hover:underline"
                >
                  {e.email}
                </a>
                {e.telegramId && (
                  <div className="text-[10px] font-mono text-[var(--color-text-faint)]">
                    TG: {e.telegramId}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-xs text-[var(--color-text-dim)] max-w-xs">
                {e.notes ? (
                  <span className="line-clamp-2 italic">«{e.notes}»</span>
                ) : (
                  <span className="text-[var(--color-text-faint)]">—</span>
                )}
              </TableCell>
              <TableCell className="text-right text-xs text-[var(--color-text-dim)] tabular-nums">
                {formatDate(e.createdAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
