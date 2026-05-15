'use client';

import { useState, useTransition } from 'react';
import {
  AppleIcon,
  Calendar as CalendarIcon,
  Copy,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { regenerateAdminIcalTokenAction } from '@/lib/actions/admin';

/**
 * Bouton + modal pour s'abonner au feed iCal du calendrier admin depuis
 * Apple Calendar, Google Calendar, Outlook. Le token est passé en prop
 * (fourni par la page serveur via getOrCreateAdminIcalTokenAction).
 *
 * Détail iOS : un lien `webcal://` ouvert sur iPhone propose directement
 * l'ajout dans Calendar.app, sans copie/colle. Sur desktop, on copie l'URL
 * que l'utilisateur colle dans son client.
 */
export function IcalSubscribeButton({ token }: { token: string | null }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [currentToken, setCurrentToken] = useState(token);

  if (!currentToken) {
    // Pas de token disponible (probable erreur serveur). On cache le bouton
    // plutôt que d'afficher un truc cassé.
    return null;
  }

  // L'URL https:// sert pour Google Calendar / Outlook (l'utilisateur la
  // colle dans "ajouter par URL"). L'URL webcal:// est le scheme reconnu
  // par iOS / macOS Calendar.app pour proposer l'ajout en 1 tap.
  const httpsUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/calendar/feed/${currentToken}/calendar.ics`
      : `/api/calendar/feed/${currentToken}/calendar.ics`;
  const webcalUrl = httpsUrl.replace(/^https?:\/\//, 'webcal://');

  function copyHttps() {
    navigator.clipboard.writeText(httpsUrl);
    toast({ title: 'URL copiée' });
  }

  function regenerate() {
    if (
      !confirm(
        "Régénérer va invalider l'URL actuelle. Les calendriers déjà abonnés cesseront de se mettre à jour. Continuer ?"
      )
    )
      return;
    start(async () => {
      const result = await regenerateAdminIcalTokenAction();
      if (result.success) {
        setCurrentToken(result.data.token);
        toast({ title: '✓ Token régénéré', description: 'Nouvelle URL active.' });
      } else {
        toast({
          title: 'Erreur',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <CalendarIcon className="h-3.5 w-3.5" />
        S&apos;abonner
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>S&apos;abonner au calendrier</DialogTitle>
          <DialogDescription>
            Le calendrier reste à jour automatiquement dans ton agenda perso.
            Toutes les sessions site + coachings offline non-annulés.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* iOS / macOS — webcal:// = 1 tap pour ajouter */}
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <AppleIcon className="h-4 w-4" />
              iPhone / iPad / Mac
            </div>
            <p className="text-xs text-[var(--color-text-dim)] mb-2">
              Ouvre ce lien depuis ton appareil Apple — Calendar.app proposera
              automatiquement de l&apos;ajouter.
            </p>
            <Button asChild variant="default" size="sm" className="w-full">
              <a href={webcalUrl}>
                <CalendarIcon className="h-3.5 w-3.5" />
                Ajouter à Apple Calendar
              </a>
            </Button>
          </div>

          {/* Google / Outlook / autre — copy URL */}
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
            <div className="text-sm font-medium mb-2">
              Google Calendar / Outlook
            </div>
            <p className="text-xs text-[var(--color-text-dim)] mb-2">
              Colle cette URL dans &laquo; Autres calendriers → À partir
              d&apos;une URL &raquo; (Google) ou &laquo; Ajouter un
              calendrier → S&apos;abonner à partir d&apos;Internet &raquo;
              (Outlook).
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={httpsUrl}
                className="font-mono text-[11px]"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button
                type="button"
                size="default"
                variant="secondary"
                onClick={copyHttps}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-tint)] border border-[var(--color-border)] p-3 text-xs text-[var(--color-text-dim)]">
            ℹ️ L&apos;URL contient un token unique. Ne la partage qu&apos;avec
            des personnes de confiance. Tu peux la révoquer à tout moment
            ci-dessous.
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={regenerate}
            disabled={pending}
            className="text-rose-300 light:text-rose-700"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Régénérer le token
          </Button>
          <Button variant="default" onClick={() => setOpen(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
