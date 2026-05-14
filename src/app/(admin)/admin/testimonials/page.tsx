import { desc, eq } from 'drizzle-orm';
import { MessageSquare } from 'lucide-react';
import { db } from '@/lib/db';
import { testimonials, users } from '@/lib/db/schema';
import {
  AdminContainer,
  AdminPageHeader,
} from '@/components/admin/page-header';
import { StatCard, StatCardGrid } from '@/components/admin/stat-card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { TestimonialsList } from '@/components/admin/testimonials-list';

export const dynamic = 'force-dynamic';

export default async function AdminTestimonialsPage() {
  const rows = await db
    .select({
      id: testimonials.id,
      body: testimonials.body,
      status: testimonials.status,
      createdAt: testimonials.createdAt,
      userName: users.name,
      userTelegramUsername: users.telegramUsername,
      userTelegramPhotoUrl: users.telegramPhotoUrl,
    })
    .from(testimonials)
    .leftJoin(users, eq(testimonials.userId, users.id))
    .orderBy(desc(testimonials.createdAt))
    .limit(200);

  const pending = rows.filter((r) => r.status === 'pending');
  const published = rows.filter((r) => r.status === 'published');
  const rejected = rows.filter((r) => r.status === 'rejected');

  return (
    <AdminContainer>
      <AdminPageHeader
        title="Témoignages"
        description="Modère les avis soumis via la commande /temoignage du bot."
      />

      <StatCardGrid cols={3} className="mb-5">
        <StatCard
          label="En attente"
          value={pending.length}
          tone={pending.length > 0 ? 'warning' : 'default'}
          icon={<MessageSquare className="h-4 w-4" />}
        />
        <StatCard
          label="Publiés"
          value={published.length}
          tone={published.length > 0 ? 'success' : 'default'}
        />
        <StatCard label="Rejetés" value={rejected.length} />
      </StatCardGrid>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            En attente
            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0">
              {pending.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="published">
            Publiés
            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0">
              {published.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejetés
            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0">
              {rejected.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <TestimonialsList items={pending} showActions />
        </TabsContent>
        <TabsContent value="published">
          <TestimonialsList items={published} />
        </TabsContent>
        <TabsContent value="rejected">
          <TestimonialsList items={rejected} />
        </TabsContent>
      </Tabs>
    </AdminContainer>
  );
}
