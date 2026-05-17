import { cn } from '@/lib/utils';

interface Entry {
  id: string;
  entryDate: string;
  mood: number;
  note: string | null;
  createdAt: Date;
}

/**
 * Affiche les 30 dernières entrées : sparkline visuelle des mood + liste
 * compacte avec notes.
 */
export function EmotionHistory({ entries }: { entries: Entry[] }) {
  return (
    <div className="space-y-4">
      {/* Sparkline 30 jours */}
      <SparklineMood entries={entries} />

      {/* Liste détaillée */}
      <div className="glass rounded-[var(--radius-md)] overflow-hidden divide-y divide-[var(--color-border)]">
        {entries.map((e) => (
          <div key={e.id} className="px-4 py-3 flex items-start gap-3">
            <div
              className={cn(
                'inline-flex h-10 w-10 items-center justify-center rounded-full text-lg flex-shrink-0',
                e.mood <= 3
                  ? 'bg-rose-500/15 text-rose-300'
                  : e.mood <= 6
                    ? 'bg-amber-500/15 text-amber-300'
                    : 'bg-emerald-500/15 text-emerald-300'
              )}
            >
              {moodEmoji(e.mood)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{e.mood}/10</span>
                <span className="text-[10px] text-[var(--color-text-faint)] font-mono">
                  {new Date(e.entryDate + 'T12:00:00Z').toLocaleDateString(
                    'fr-FR',
                    { day: '2-digit', month: 'short' }
                  )}
                </span>
              </div>
              {e.note && (
                <p className="text-xs text-[var(--color-text-dim)] italic mt-0.5 break-words">
                  «{e.note}»
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function moodEmoji(mood: number): string {
  if (mood <= 2) return '😰';
  if (mood <= 4) return '😕';
  if (mood === 5) return '🙂';
  if (mood <= 7) return '😊';
  if (mood <= 9) return '😄';
  return '🔥';
}

function SparklineMood({ entries }: { entries: Entry[] }) {
  if (entries.length < 2) return null;
  // Tri ascendant (chronologique) pour le rendu
  const sorted = [...entries].reverse();
  const width = 600;
  const height = 80;
  const max = 10;
  const min = 1;
  const stepX = width / Math.max(1, sorted.length - 1);

  const points = sorted.map((e, i) => {
    const x = i * stepX;
    const y = height - ((e.mood - min) / (max - min)) * height;
    return { x, y, mood: e.mood };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const areaD = pathD + ` L ${width} ${height} L 0 ${height} Z`;

  return (
    <div className="glass rounded-[var(--radius-md)] p-4">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-faint)]">
          Évolution sur {sorted.length} entrées
        </span>
        <span className="text-[10px] text-[var(--color-text-faint)] font-mono">
          1-10
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-20"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="mood-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(16,185,129,0.4)" />
            <stop offset="100%" stopColor="rgba(16,185,129,0)" />
          </linearGradient>
          <linearGradient id="mood-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgb(244,63,94)" />
            <stop offset="50%" stopColor="rgb(245,158,11)" />
            <stop offset="100%" stopColor="rgb(16,185,129)" />
          </linearGradient>
        </defs>
        {/* Ligne horizontale 5 (neutre) */}
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="currentColor"
          strokeOpacity="0.15"
          strokeDasharray="3 3"
        />
        <path d={areaD} fill="url(#mood-gradient)" />
        <path d={pathD} fill="none" stroke="url(#mood-stroke)" strokeWidth="2" />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="2.5"
            fill={
              p.mood <= 3 ? '#f43f5e' : p.mood <= 6 ? '#f59e0b' : '#10b981'
            }
          />
        ))}
      </svg>
    </div>
  );
}
