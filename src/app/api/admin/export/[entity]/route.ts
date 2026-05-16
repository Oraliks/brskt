import { desc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import {
  adminAuditLogs,
  bookings,
  formationWaitlist,
  offlineCoachings,
  users,
} from '@/lib/db/schema';
import { requireAdmin } from '@/lib/auth/server';
import { csvResponseHeaders, toCsv, type CsvColumn } from '@/lib/csv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Endpoint d'export CSV admin.
 *  GET /api/admin/export/bookings.csv
 *  GET /api/admin/export/coachings.csv
 *  GET /api/admin/export/waitlist.csv
 *  GET /api/admin/export/audit.csv
 *
 * Le client (ex: <a download>) télécharge directement. Pas de paramètres
 * pour l'instant — on exporte tout (limit 5000 par sécu).
 *
 * Sécurité : requireAdmin() en début → 404 si non-admin (pas leak).
 */

type Entity = 'bookings' | 'coachings' | 'waitlist' | 'audit';

const MAX_ROWS = 5000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ entity: string }> }
) {
  await requireAdmin();
  const { entity: raw } = await params;
  const entity = raw.replace(/\.csv$/, '') as Entity;

  switch (entity) {
    case 'bookings':
      return exportBookings();
    case 'coachings':
      return exportCoachings();
    case 'waitlist':
      return exportWaitlist();
    case 'audit':
      return exportAudit();
    default:
      notFound();
  }
}

async function exportBookings() {
  const rows = await db.query.bookings.findMany({
    orderBy: [desc(bookings.createdAt)],
    with: {
      user: { columns: { name: true, email: true, telegramUsername: true } },
      formation: { columns: { title: true, mode: true, priceEur: true } },
    },
    limit: MAX_ROWS,
  });

  const columns: CsvColumn<(typeof rows)[number]>[] = [
    { header: 'id', value: (r) => r.id },
    { header: 'createdAt', value: (r) => r.createdAt },
    { header: 'userName', value: (r) => r.user.name },
    { header: 'userEmail', value: (r) => r.user.email },
    {
      header: 'telegramUsername',
      value: (r) => r.user.telegramUsername,
    },
    { header: 'formationTitle', value: (r) => r.formation.title },
    { header: 'formationMode', value: (r) => r.formation.mode },
    {
      header: 'formationPriceEur',
      value: (r) => Number(r.formation.priceEur),
    },
    { header: 'status', value: (r) => r.status },
    { header: 'preferredAsap', value: (r) => r.preferredAsap },
    {
      header: 'preferredDates',
      value: (r) =>
        r.preferredDates
          ?.map((d) => `${d.start}→${d.end}`)
          .join(' | ') ?? '',
    },
    { header: 'confirmedDate', value: (r) => r.confirmedDate },
    { header: 'adminProposedDate', value: (r) => r.adminProposedDate },
    { header: 'paymentPlan', value: (r) => r.paymentPlan },
    {
      header: 'installmentsPaid',
      value: (r) => `${r.installmentsPaid}/${r.installmentTotal}`,
    },
    { header: 'adminNotes', value: (r) => r.adminNotes },
  ];

  const csv = toCsv(rows, columns);
  return new Response(csv, { headers: csvResponseHeaders('bookings') });
}

async function exportCoachings() {
  const rows = await db.query.offlineCoachings.findMany({
    orderBy: [desc(offlineCoachings.createdAt)],
    limit: MAX_ROWS,
  });

  const columns: CsvColumn<(typeof rows)[number]>[] = [
    { header: 'id', value: (r) => r.id },
    { header: 'createdAt', value: (r) => r.createdAt },
    { header: 'fullName', value: (r) => r.fullName },
    { header: 'email', value: (r) => r.email },
    { header: 'phone', value: (r) => r.phone },
    { header: 'mode', value: (r) => r.mode },
    { header: 'totalAmountEur', value: (r) => Number(r.totalAmountEur) },
    { header: 'paidAmountEur', value: (r) => Number(r.paidAmountEur) },
    {
      header: 'remainingEur',
      value: (r) =>
        Math.max(0, Number(r.totalAmountEur) - Number(r.paidAmountEur)),
    },
    { header: 'scheduledDate', value: (r) => r.scheduledDate },
    { header: 'status', value: (r) => r.status },
    { header: 'notes', value: (r) => r.notes },
  ];

  const csv = toCsv(rows, columns);
  return new Response(csv, { headers: csvResponseHeaders('coachings') });
}

async function exportWaitlist() {
  const rows = await db.query.formationWaitlist.findMany({
    orderBy: [desc(formationWaitlist.createdAt)],
    limit: MAX_ROWS,
  });

  const columns: CsvColumn<(typeof rows)[number]>[] = [
    { header: 'id', value: (r) => r.id },
    { header: 'createdAt', value: (r) => r.createdAt },
    { header: 'mode', value: (r) => r.mode },
    { header: 'email', value: (r) => r.email },
    { header: 'firstName', value: (r) => r.firstName },
    { header: 'telegramId', value: (r) => r.telegramId },
    { header: 'notes', value: (r) => r.notes },
    { header: 'notifiedAt', value: (r) => r.notifiedAt },
  ];

  const csv = toCsv(rows, columns);
  return new Response(csv, { headers: csvResponseHeaders('waitlist') });
}

async function exportAudit() {
  // L'audit log peut être très gros : on limite à MAX_ROWS récents.
  const rows = await db
    .select({
      id: adminAuditLogs.id,
      createdAt: adminAuditLogs.createdAt,
      action: adminAuditLogs.action,
      targetType: adminAuditLogs.targetType,
      targetId: adminAuditLogs.targetId,
      adminName: users.name,
      adminEmail: users.email,
      adminTelegramUsername: users.telegramUsername,
    })
    .from(adminAuditLogs)
    .leftJoin(users, eq(adminAuditLogs.adminId, users.id))
    .orderBy(desc(adminAuditLogs.createdAt))
    .limit(MAX_ROWS);

  const columns: CsvColumn<(typeof rows)[number]>[] = [
    { header: 'id', value: (r) => r.id },
    { header: 'createdAt', value: (r) => r.createdAt },
    { header: 'action', value: (r) => r.action },
    { header: 'targetType', value: (r) => r.targetType },
    { header: 'targetId', value: (r) => r.targetId },
    { header: 'adminName', value: (r) => r.adminName },
    { header: 'adminEmail', value: (r) => r.adminEmail },
    {
      header: 'adminTelegramUsername',
      value: (r) => r.adminTelegramUsername,
    },
  ];

  const csv = toCsv(rows, columns);
  return new Response(csv, { headers: csvResponseHeaders('audit') });
}
