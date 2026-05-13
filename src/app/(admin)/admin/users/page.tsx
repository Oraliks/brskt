import { desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { AdminContainer, AdminPageHeader } from '@/components/admin/page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const list = await db.query.users.findMany({
    orderBy: [desc(users.createdAt)],
    limit: 200,
  });

  return (
    <AdminContainer>
      <AdminPageHeader
        title="Utilisateurs"
        description={`${list.length} utilisateurs au total.`}
      />

      <div className="glass rounded-[var(--radius-lg)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telegram</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Onboarding</TableHead>
              <TableHead>Inscrit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {u.telegramPhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={u.telegramPhotoUrl}
                        alt=""
                        className="h-7 w-7 rounded-full"
                      />
                    ) : (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 text-xs font-medium text-white">
                        {u.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="text-sm">{u.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {u.email ?? (
                    <span className="italic text-[var(--color-text-faint)]">
                      en attente
                    </span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {u.telegramUsername
                    ? `@${u.telegramUsername}`
                    : u.telegramId
                    ? String(u.telegramId)
                    : '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={u.role === 'admin' ? 'gold' : 'secondary'}>
                    {u.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  {u.onboardingCompletedAt ? (
                    <Badge variant="success">Complet</Badge>
                  ) : (
                    <Badge variant="warning">En cours</Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs text-[var(--color-text-dim)]">
                  {formatDate(u.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AdminContainer>
  );
}
