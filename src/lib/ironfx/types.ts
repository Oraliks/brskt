export type IronFXMode = 'api' | 'manual';

export interface IronFXClientStatus {
  accountId: string;
  signupDetected: boolean;
  depositTotal: number;
  depositCurrency: string;
  /** True quand IronFX nous a payé la commission CPA (objectif business : $1 minimum) */
  cpaQualified: boolean;
  accountClosed: boolean;
  /** True si le client a retiré son argent */
  hasWithdrawn: boolean;
  lastUpdated: Date;
}

export interface IronFXAdapter {
  readonly mode: IronFXMode;

  /**
   * Vérifie le statut d'un compte client par son ID broker.
   * Retourne null si le compte n'est pas connu.
   */
  getClientStatus(accountId: string): Promise<IronFXClientStatus | null>;

  /**
   * Liste les statuts mis à jour depuis une date donnée.
   * Utilisé par le CRON quotidien.
   */
  getRecentUpdates(since: Date): Promise<IronFXClientStatus[]>;
}
