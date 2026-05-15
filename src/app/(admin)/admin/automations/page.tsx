import { Bot, CreditCard, MessageSquare, Star, TrendingDown, Zap } from 'lucide-react';
import {
  AdminContainer,
  AdminPageHeader,
} from '@/components/admin/page-header';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AutomationsForm } from '@/components/admin/automations-form';
import { getAutomations } from '@/lib/settings/automations';

export const dynamic = 'force-dynamic';

export default async function AutomationsPage() {
  const config = await getAutomations();

  // Compteur des autom actives pour la pill du header
  const active = [
    config.paymentReminder.enabled,
    config.vipDropoff.enabled,
    config.testimonialRequest.enabled,
    config.weeklyAdminStats.enabled,
    config.formationReminders.enabled,
    config.npsRequest.enabled,
  ].filter(Boolean).length;

  return (
    <AdminContainer>
      <AdminPageHeader
        title="Automatisations"
        description="Toggles et templates des CRONs qui tournent en arrière-plan."
        actions={
          <Badge variant={active >= 4 ? 'success' : 'secondary'}>
            <Zap className="h-3 w-3 mr-1" />
            {active} / 6 actives
          </Badge>
        }
      />

      <Tabs defaultValue="payment">
        <TabsList className="flex-wrap">
          <TabsTrigger value="payment" className="gap-1.5">
            <CreditCard className="h-3.5 w-3.5" />
            Paiements
          </TabsTrigger>
          <TabsTrigger value="vip" className="gap-1.5">
            <TrendingDown className="h-3.5 w-3.5" />
            VIP drop-off
          </TabsTrigger>
          <TabsTrigger value="testimonial" className="gap-1.5">
            <Star className="h-3.5 w-3.5" />
            Témoignages
          </TabsTrigger>
          <TabsTrigger value="formation" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            Formation
          </TabsTrigger>
          <TabsTrigger value="admin" className="gap-1.5">
            <Bot className="h-3.5 w-3.5" />
            Admin
          </TabsTrigger>
        </TabsList>

        <AutomationsForm initial={config} />
      </Tabs>
    </AdminContainer>
  );
}
