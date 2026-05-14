import { desc } from 'drizzle-orm';
import { Users as UsersIcon } from 'lucide-react';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import {
  AdminContainer,
  AdminPageHeader,
} from '@/components/admin/page-header';
import { StatCard, StatCardGrid } from '@/components/admin/stat-card';
import { UsersTable } from '@/components/admin/users-table';
import { requireAdmin } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const session = await requireAdmin();
  const list = await db.query.users.findMany({
    orderBy: [desc(users.createdAt)],
    limit: 500,
    columns: {
      id: true,
      name: true,
      email: true,
      role: true,
      telegramId: true,
      telegramUsername: true,
      telegramPhotoUrl: true,
      onboardingCompletedAt: true,
      bannedAt: true,
      bannedReason: true,
      createdAt: true,
    },
  });

  const stats = {
    total: list.length,
    admins: list.filter((u) => u.role === 'admin').length,
    onboarding: list.filter((u) => !u.onboardingCompletedAt).length,
    banned: list.filter((u) => u.bannedAt).length,
  };

  return (
    <AdminContainer>
      <AdminPageHeader
        title="Utilisateurs"
        description="Recherche, modération, gestion des rôles. Les admins ne peuvent ni se bannir, ni se rétrograder eux-mêmes."
      />

      <StatCardGrid className="mb-5">
        <StatCard label="Total" value={stats.total} icon={<UsersIcon className="h-4 w-4" />} />
        <StatCard label="Admins" value={stats.admins} tone="info" />
        <StatCard
          label="Onboarding incomplet"
          value={stats.onboarding}
          tone={stats.onboarding > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Bannis"
          value={stats.banned}
          tone={stats.banned > 0 ? 'danger' : 'default'}
        />
      </StatCardGrid>

      <UsersTable users={list} currentAdminId={session.user.id} />
    </AdminContainer>
  );
}
