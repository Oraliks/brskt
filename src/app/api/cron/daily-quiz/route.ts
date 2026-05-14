import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { quizQuestions, users } from '@/lib/db/schema';
import { sendDirectMessage } from '@/lib/telegram/helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * CRON quotidien — pousse une nouvelle question quiz à tous les users
 * qui ont une interaction bot récente (i.e. ont déjà /start le bot).
 *
 * Stratégie :
 *  1. Pioche la 1ère question avec sent_at = null et active = true
 *     (ordre stable par createdAt pour garantir l'ordre des questions)
 *  2. Set sent_at = NOW() sur cette question
 *  3. DM le bot à tous les users avec botLastInteractionAt non null
 *     (i.e. déjà interagi au moins une fois → DM possible)
 *  4. Le user répond via /quiz (inline keyboard du dernier sent question)
 *
 * À configurer dans vercel.json :
 *   { "path": "/api/cron/daily-quiz", "schedule": "0 18 * * *" }
 *   18h UTC ≈ 19h CET en hiver, 20h CET en été.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Check feature toggle admin
  const { getBotFeatures } = await import('@/lib/settings/bot-features');
  const features = await getBotFeatures();
  if (!features.quiz) {
    return Response.json({
      success: true,
      message: 'Quiz feature désactivée par admin (toggle off)',
      sent: 0,
    });
  }

  // 1. Pioche la prochaine question non envoyée
  const next = await db.query.quizQuestions.findFirst({
    where: and(eq(quizQuestions.active, true), isNull(quizQuestions.sentAt)),
    orderBy: [asc(quizQuestions.createdAt)],
  });

  if (!next) {
    return Response.json({
      success: true,
      message: 'Aucune nouvelle question disponible — ajouter via /admin/quiz',
      sent: 0,
    });
  }

  // 2. Marque la question comme envoyée
  await db
    .update(quizQuestions)
    .set({ sentAt: new Date() })
    .where(eq(quizQuestions.id, next.id));

  // 3. Liste les users à notifier : ceux qui ont déjà interagi avec le bot
  //    (sinon Telegram refuse le DM avec 403)
  const recipients = await db.query.users.findMany({
    where: isNotNull(users.botLastInteractionAt),
    columns: { id: true, telegramId: true, telegramFirstName: true },
  });

  // 4. Envoi DM en parallèle (mais bounded — Telegram limite 30 msg/s)
  const BATCH_SIZE = 20;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (u) => {
        if (!u.telegramId) return false;
        return sendDirectMessage(
          Number(u.telegramId),
          `📝 <b>Question du jour</b>\n\n` +
            `Salut ${u.telegramFirstName ?? ''} !\n\n` +
            `Tape <code>/quiz</code> pour répondre. Tu peux aussi consulter ` +
            `le <code>/leaderboard</code> de la semaine.`,
          { disableWebPreview: true }
        );
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value === true) sent++;
      else failed++;
    }
    // Pause 1s entre batchs pour rester sous la limite Telegram
    if (i + BATCH_SIZE < recipients.length) {
      await new Promise((res) => setTimeout(res, 1000));
    }
  }

  return Response.json({
    success: true,
    questionId: next.id,
    eligible: recipients.length,
    sent,
    failed,
  });
}
