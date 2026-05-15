'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Check,
  ClipboardPaste,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import {
  adminBulkImportOfflineCoachingsAction,
  adminCreateOfflineCoachingAction,
  adminDeleteOfflineCoachingAction,
  adminUpdateOfflineCoachingAction,
} from '@/lib/actions/admin';
import { matchHeader, parseAmount, parseTsv } from '@/lib/tsv-parser';
import { cn, formatDate } from '@/lib/utils';

export interface CoachingItem {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  mode: string;
  totalAmountEur: number;
  paidAmountEur: number;
  scheduledDate: string | null;
  notes: string | null;
  status: 'active' | 'completed' | 'cancelled';
  createdAt: string;
}

const STATUS_VARIANT: Record<
  CoachingItem['status'],
  'default' | 'success' | 'danger' | 'secondary'
> = {
  active: 'default',
  completed: 'success',
  cancelled: 'danger',
};

const STATUS_LABEL: Record<CoachingItem['status'], string> = {
  active: 'En cours',
  completed: 'Terminé',
  cancelled: 'Annulé',
};

export function CoachingsList({ items }: { items: CoachingItem[] }) {
  const [importOpen, setImportOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [edit, setEdit] = useState<CoachingItem | null>(null);

  return (
    <>
      <div className="flex flex-wrap gap-2 justify-end mb-3">
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="secondary">
              <ClipboardPaste className="h-4 w-4" />
              Importer depuis Excel
            </Button>
          </DialogTrigger>
          <ImportDialog onDone={() => setImportOpen(false)} />
        </Dialog>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Nouveau coaching
            </Button>
          </DialogTrigger>
          <CreateDialog onDone={() => setCreateOpen(false)} />
        </Dialog>
      </div>

      <div className="glass rounded-[var(--radius-lg)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Payé / Total</TableHead>
              <TableHead>Reste dû</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>État</TableHead>
              <TableHead className="text-right">⋯</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-10 text-center text-sm text-[var(--color-text-dim)]"
                >
                  Aucun coaching offline. Importe depuis Excel ↗
                </TableCell>
              </TableRow>
            )}
            {items.map((c) => {
              const remaining = Math.max(
                0,
                c.totalAmountEur - c.paidAmountEur
              );
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="text-sm font-medium">{c.fullName}</div>
                    {(c.email || c.phone) && (
                      <div className="text-xs text-[var(--color-text-dim)]">
                        {c.email && <span>{c.email}</span>}
                        {c.email && c.phone && ' · '}
                        {c.phone && <span>{c.phone}</span>}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {c.mode}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono tabular-nums text-sm">
                    {c.paidAmountEur.toLocaleString('fr-FR')} /{' '}
                    {c.totalAmountEur.toLocaleString('fr-FR')}€
                  </TableCell>
                  <TableCell
                    className={cn(
                      'font-mono tabular-nums text-sm',
                      remaining > 0
                        ? 'text-amber-300 light:text-amber-700'
                        : 'text-emerald-300 light:text-emerald-700'
                    )}
                  >
                    {remaining > 0 ? `${remaining.toLocaleString('fr-FR')}€` : '✓ soldé'}
                  </TableCell>
                  <TableCell className="text-xs text-[var(--color-text-dim)]">
                    {c.scheduledDate ? formatDate(c.scheduledDate) : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[c.status]}>
                      {STATUS_LABEL[c.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEdit(c)}
                      className="h-8 w-8"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        {edit && <EditDialog initial={edit} onDone={() => setEdit(null)} />}
      </Dialog>
    </>
  );
}

// ============================================================
// CREATE
// ============================================================

function CreateDialog({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [mode, setMode] = useState('remote');
  const [total, setTotal] = useState('');
  const [paid, setPaid] = useState('0');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');

  function submit() {
    const totalNum = Number(total);
    const paidNum = Number(paid);
    if (!fullName.trim()) {
      toast({ title: 'Nom requis', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(totalNum) || totalNum < 0) {
      toast({ title: 'Total invalide', variant: 'destructive' });
      return;
    }
    start(async () => {
      const result = await adminCreateOfflineCoachingAction({
        fullName,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        mode: mode.trim() || 'remote',
        totalAmountEur: totalNum,
        paidAmountEur: Number.isFinite(paidNum) ? paidNum : 0,
        scheduledDate: date || undefined,
        notes: notes.trim() || undefined,
      });
      if (result.success) {
        toast({ title: '✓ Coaching ajouté' });
        onDone();
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

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Nouveau coaching</DialogTitle>
        <DialogDescription>
          Pour 1 client. Pour plusieurs, utilise l&apos;import depuis Excel.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <Field label="Nom complet *">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Téléphone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        </div>
        <Field label="Mode (libre, ex. remote / onsite / coaching VIP)">
          <Input value={mode} onChange={(e) => setMode(e.target.value)} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Total dû (€) *">
            <Input
              type="number"
              min={0}
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              className="tabular-nums"
            />
          </Field>
          <Field label="Déjà payé (€)">
            <Input
              type="number"
              min={0}
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
              className="tabular-nums"
            />
          </Field>
        </div>
        <Field label="Date prévue (optionnel)">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Notes">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={2000}
          />
        </Field>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Ajouter
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ============================================================
// EDIT
// ============================================================

function EditDialog({
  initial,
  onDone,
}: {
  initial: CoachingItem;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fullName, setFullName] = useState(initial.fullName);
  const [email, setEmail] = useState(initial.email ?? '');
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [mode, setMode] = useState(initial.mode);
  const [total, setTotal] = useState(String(initial.totalAmountEur));
  const [paid, setPaid] = useState(String(initial.paidAmountEur));
  const [date, setDate] = useState(initial.scheduledDate ?? '');
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [status, setStatus] = useState<CoachingItem['status']>(initial.status);

  function submit() {
    start(async () => {
      const result = await adminUpdateOfflineCoachingAction({
        coachingId: initial.id,
        fullName,
        email: email.trim() || '',
        phone: phone.trim() || undefined,
        mode,
        totalAmountEur: Number(total),
        paidAmountEur: Number(paid),
        scheduledDate: date || null,
        notes,
        status,
      });
      if (result.success) {
        toast({ title: '✓ Mis à jour' });
        onDone();
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

  function del() {
    if (!confirm(`Supprimer "${initial.fullName}" ?`)) return;
    start(async () => {
      const result = await adminDeleteOfflineCoachingAction({
        coachingId: initial.id,
      });
      if (result.success) {
        toast({ title: '✓ Supprimé' });
        onDone();
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

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Éditer {initial.fullName}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <Field label="Nom complet">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Téléphone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        </div>
        <Field label="Mode">
          <Input value={mode} onChange={(e) => setMode(e.target.value)} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Total dû (€)">
            <Input
              type="number"
              min={0}
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              className="tabular-nums"
            />
          </Field>
          <Field label="Déjà payé (€)">
            <Input
              type="number"
              min={0}
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
              className="tabular-nums"
            />
          </Field>
        </div>
        <Field label="Date prévue">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="État">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as CoachingItem['status'])}
            className="w-full h-10 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/[0.02] px-3 text-sm"
          >
            <option value="active">En cours</option>
            <option value="completed">Terminé</option>
            <option value="cancelled">Annulé</option>
          </select>
        </Field>
        <Field label="Notes">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={2000}
          />
        </Field>
      </div>
      <DialogFooter>
        <Button
          variant="ghost"
          onClick={del}
          disabled={pending}
          className="text-rose-300 light:text-rose-700"
        >
          <Trash2 className="h-4 w-4" />
          Supprimer
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Enregistrer
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ============================================================
// IMPORT
// ============================================================

interface ParsedRow {
  fullName?: string;
  email?: string;
  phone?: string;
  mode?: string;
  totalAmountEur?: number;
  paidAmountEur?: number;
  scheduledDate?: string;
  notes?: string;
  valid: boolean;
  warnings: string[];
}

function ImportDialog({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [raw, setRaw] = useState('');

  const parsed = useMemo<{
    rows: ParsedRow[];
    headers: string[];
    mapping: Record<string, string | null>;
  }>(() => {
    if (!raw.trim()) return { rows: [], headers: [], mapping: {} };
    const { headers, rows } = parseTsv(raw);
    const mapping: Record<string, string | null> = {};
    for (const h of headers) {
      mapping[h] = matchHeader(h);
    }

    const out: ParsedRow[] = rows.map((row) => {
      const r: ParsedRow = { valid: true, warnings: [] };
      for (const [origHeader, canonical] of Object.entries(mapping)) {
        if (!canonical) continue;
        const v = row[origHeader] ?? '';
        if (canonical === 'totalAmountEur') {
          const num = parseAmount(v);
          if (num !== null) r.totalAmountEur = num;
        } else if (canonical === 'paidAmountEur') {
          const num = parseAmount(v);
          if (num !== null) r.paidAmountEur = num;
        } else {
          (r as unknown as Record<string, unknown>)[canonical] = v;
        }
      }
      if (!r.fullName || r.fullName.length < 2) {
        r.valid = false;
        r.warnings.push('Nom manquant');
      }
      if (r.totalAmountEur === undefined) {
        r.valid = false;
        r.warnings.push('Total manquant');
      }
      return r;
    });

    return { rows: out, headers, mapping };
  }, [raw]);

  const validRows = parsed.rows.filter((r) => r.valid);
  const invalidRows = parsed.rows.filter((r) => !r.valid);

  function submit() {
    if (validRows.length === 0) {
      toast({
        title: 'Aucune ligne valide',
        description: 'Vérifie les colonnes (Nom + Total requis)',
        variant: 'destructive',
      });
      return;
    }
    start(async () => {
      const items = validRows.map((r) => ({
        fullName: r.fullName!,
        email: r.email,
        phone: r.phone,
        mode: r.mode || 'remote',
        totalAmountEur: r.totalAmountEur!,
        paidAmountEur: r.paidAmountEur ?? 0,
        scheduledDate: r.scheduledDate,
        notes: r.notes,
      }));
      const result = await adminBulkImportOfflineCoachingsAction({ items });
      if (result.success) {
        toast({
          title: `✓ ${result.data.inserted} coaching(s) importé(s)`,
        });
        onDone();
        router.refresh();
      } else {
        toast({
          title: 'Erreur import',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  }

  return (
    <DialogContent className="max-w-3xl">
      <DialogHeader>
        <DialogTitle>Importer depuis Excel</DialogTitle>
        <DialogDescription>
          Copie-colle ton tableau depuis Excel (Ctrl+A puis Ctrl+C dans
          Excel, Ctrl+V ici). On reconnaît automatiquement les colonnes
          courantes (Nom, Email, Téléphone, Total, Payé, Date, Notes).
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <div>
          <Label className="text-xs">Colle ton tableau ici</Label>
          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={6}
            placeholder={`Nom\tEmail\tTotal\tPayé\nJean Dupont\tjean@x.com\t1500\t500\nMarie Martin\tmarie@x.com\t3500\t3500`}
            className="font-mono text-xs"
          />
          <p className="mt-1 text-[10px] text-[var(--color-text-faint)]">
            Format reconnu : tabs (Excel natif), virgule (CSV) ou point-virgule
            (CSV FR). 1re ligne = en-têtes.
          </p>
        </div>

        {parsed.headers.length > 0 && (
          <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-tint)] border border-[var(--color-border)] p-3">
            <div className="text-xs font-medium mb-2">Mapping des colonnes</div>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {parsed.headers.map((h) => {
                const mapped = parsed.mapping[h];
                return (
                  <span
                    key={h}
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-mono',
                      mapped
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 light:text-emerald-700'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300 light:text-rose-700'
                    )}
                  >
                    {mapped ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                    {h}
                    {mapped && (
                      <span className="opacity-70">→ {mapped}</span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {parsed.rows.length > 0 && (
          <div className="text-xs text-[var(--color-text-dim)]">
            <strong className="text-emerald-300 light:text-emerald-700">
              {validRows.length}
            </strong>{' '}
            ligne(s) prête(s) à importer
            {invalidRows.length > 0 && (
              <>
                ,{' '}
                <strong className="text-rose-300 light:text-rose-700">
                  {invalidRows.length}
                </strong>{' '}
                ignorée(s) (
                {Array.from(
                  new Set(invalidRows.flatMap((r) => r.warnings))
                ).join(', ')}
                )
              </>
            )}
          </div>
        )}

        {validRows.length > 0 && (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-[var(--color-surface-tint)] sticky top-0">
                <tr>
                  <th className="px-2 py-1.5 text-left">Nom</th>
                  <th className="px-2 py-1.5 text-left">Email</th>
                  <th className="px-2 py-1.5 text-right">Total</th>
                  <th className="px-2 py-1.5 text-right">Payé</th>
                  <th className="px-2 py-1.5 text-right">Reste</th>
                </tr>
              </thead>
              <tbody>
                {validRows.slice(0, 20).map((r, i) => {
                  const paid = r.paidAmountEur ?? 0;
                  const total = r.totalAmountEur ?? 0;
                  return (
                    <tr key={i} className="border-t border-[var(--color-border)]">
                      <td className="px-2 py-1">{r.fullName}</td>
                      <td className="px-2 py-1 text-[var(--color-text-dim)]">
                        {r.email ?? '—'}
                      </td>
                      <td className="px-2 py-1 text-right font-mono tabular-nums">
                        {total}€
                      </td>
                      <td className="px-2 py-1 text-right font-mono tabular-nums">
                        {paid}€
                      </td>
                      <td className="px-2 py-1 text-right font-mono tabular-nums">
                        {Math.max(0, total - paid)}€
                      </td>
                    </tr>
                  );
                })}
                {validRows.length > 20 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-2 py-1 text-center text-[var(--color-text-faint)]"
                    >
                      … et {validRows.length - 20} autres
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button
          onClick={submit}
          disabled={pending || validRows.length === 0}
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Importer {validRows.length} ligne{validRows.length > 1 ? 's' : ''}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
