import { AdminContainer, AdminPageHeader } from '@/components/admin/page-header';
import { IronFxModeForm } from '@/components/admin/ironfx-mode-form';
import { getIronFXMode } from '@/lib/ironfx';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const mode = await getIronFXMode();

  return (
    <AdminContainer>
      <AdminPageHeader
        title="Paramètres"
        description="Configuration de la plateforme."
      />

      <div className="space-y-6 max-w-3xl">
        <section className="glass rounded-[var(--radius-lg)] p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Mode IronFX</h2>
            <p className="mt-1 text-sm text-[var(--color-text-dim)]">
              Contrôle comment Boursikotons récupère le statut des comptes broker.
            </p>
          </div>
          <IronFxModeForm currentMode={mode} />
        </section>

        <section className="glass rounded-[var(--radius-lg)] p-6">
          <h2 className="text-lg font-semibold">Variables d'environnement</h2>
          <p className="mt-1 text-sm text-[var(--color-text-dim)]">
            Configurées via Vercel ou .env.local (lecture seule ici).
          </p>
          <div className="mt-4 grid sm:grid-cols-2 gap-2 text-xs">
            <EnvStatus name="TELEGRAM_BOT_TOKEN" />
            <EnvStatus name="VIP_GROUP_CHAT_ID" />
            <EnvStatus name="PADDLE_API_KEY" />
            <EnvStatus name="PAYPAL_CLIENT_ID" />
            <EnvStatus name="NOWPAYMENTS_API_KEY" />
            <EnvStatus name="IRONFX_API_KEY" optional />
            <EnvStatus name="RESEND_API_KEY" />
            <EnvStatus name="CRON_SECRET" />
          </div>
        </section>
      </div>
    </AdminContainer>
  );
}

function EnvStatus({
  name,
  optional,
}: {
  name: string;
  optional?: boolean;
}) {
  const set = Boolean(process.env[name]);
  return (
    <div className="flex items-center justify-between rounded-md bg-white/[0.02] border border-[var(--color-border)] px-3 py-2">
      <code className="font-mono">{name}</code>
      <span
        className={
          set
            ? 'text-emerald-300'
            : optional
            ? 'text-[var(--color-text-faint)]'
            : 'text-rose-300'
        }
      >
        {set ? '✓ set' : optional ? '— absent' : '✗ manquant'}
      </span>
    </div>
  );
}
