import type { IronFXAdapter, IronFXClientStatus } from './types';

/**
 * Adapter "API" pour IronFX/IronAffiliates.
 *
 * IMPORTANT : la doc API publique n'a pas été trouvée publiquement (mai 2026).
 * Cette implémentation suppose une API REST avec auth Bearer.
 * À AJUSTER une fois que tu auras les détails de ton account manager :
 *   - URL de base exacte
 *   - Schéma de réponse JSON
 *   - Méthode d'auth (Bearer / API Key header / OAuth)
 *
 * Recommandation : demander aussi une "postback URL" (S2S tracking) qui
 * pingera /api/webhooks/ironfx à chaque event. C'est plus fiable que le polling.
 */
export class IronFXApiAdapter implements IronFXAdapter {
  readonly mode = 'api' as const;

  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.IRONFX_API_URL ?? '';
    this.apiKey = process.env.IRONFX_API_KEY ?? '';

    if (!this.baseUrl || !this.apiKey) {
      throw new Error(
        'IRONFX_API_URL / IRONFX_API_KEY missing — switch to manual mode in admin'
      );
    }
  }

  async getClientStatus(accountId: string): Promise<IronFXClientStatus | null> {
    try {
      const res = await fetch(
        `${this.baseUrl}/clients/${encodeURIComponent(accountId)}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          // Court timeout pour ne pas bloquer le CRON
          signal: AbortSignal.timeout(10_000),
        }
      );

      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`IronFX API ${res.status}`);

      const data = (await res.json()) as Record<string, unknown>;
      return this.mapToStatus(accountId, data);
    } catch (err) {
      console.error('[IronFX API] getClientStatus error', err);
      return null;
    }
  }

  async getRecentUpdates(since: Date): Promise<IronFXClientStatus[]> {
    try {
      const res = await fetch(
        `${this.baseUrl}/clients/updates?since=${since.toISOString()}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
          signal: AbortSignal.timeout(30_000),
        }
      );

      if (!res.ok) return [];

      const data = (await res.json()) as {
        clients: Array<Record<string, unknown>>;
      };

      return data.clients
        .map((c) =>
          this.mapToStatus(c.accountId as string, c)
        )
        .filter((s): s is IronFXClientStatus => s !== null);
    } catch (err) {
      console.error('[IronFX API] getRecentUpdates error', err);
      return [];
    }
  }

  private mapToStatus(
    accountId: string,
    raw: Record<string, unknown>
  ): IronFXClientStatus {
    const cpaQualified = Boolean(raw.cpa_qualified ?? raw.is_qualified);
    // En mode API on a juste cpaQualified bool — on traduit en 0% ou 100%.
    // Si IronFX expose un score plus granulaire un jour (raw.progress_pct),
    // on l'utilise en priorité.
    const apiProgress =
      raw.progress_pct ?? raw.trading_progress ?? raw.progress;
    const tradingProgressPct =
      typeof apiProgress === 'number'
        ? Math.max(0, Math.min(100, apiProgress))
        : cpaQualified
        ? 100
        : 0;

    return {
      accountId,
      signupDetected: Boolean(raw.signup_detected ?? raw.has_signed_up),
      depositTotal: Number(raw.deposit_total ?? raw.total_deposits ?? 0),
      depositCurrency: String(raw.currency ?? 'EUR'),
      cpaQualified,
      tradingProgressPct,
      accountClosed: Boolean(raw.account_closed ?? raw.is_closed),
      hasWithdrawn: Boolean(raw.has_withdrawn ?? raw.withdrew),
      lastUpdated: new Date(
        (raw.updated_at as string) ?? Date.now()
      ),
    };
  }
}
