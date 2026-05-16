/**
 * Skeleton de chargement pour les pages user (dashboard, formation, vip).
 * Reproduit le hero + split typique du dashboard.
 */
export default function AppLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 md:pt-8 pb-10 animate-pulse">
      {/* Hero */}
      <div className="glass rounded-[var(--radius-xl)] p-5 md:p-7 mb-7 grid md:grid-cols-[1fr_auto] gap-5 items-end">
        <div>
          <div className="h-3 w-20 rounded bg-[var(--color-surface-tint)] mb-3" />
          <div className="h-10 md:h-14 w-64 rounded bg-[var(--color-surface-tint-strong)]" />
        </div>
        <div className="flex gap-2.5 flex-wrap">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-[var(--radius-md)] bg-[var(--color-bg-elevated)]/60 border border-[var(--color-border)] px-3.5 py-2.5 min-w-[140px]"
            >
              <div className="h-3 w-12 rounded bg-[var(--color-surface-tint)] mb-2" />
              <div className="h-6 w-14 rounded bg-[var(--color-surface-tint-strong)]" />
            </div>
          ))}
        </div>
      </div>

      {/* Split */}
      <div className="grid lg:grid-cols-[2fr_1fr] gap-4">
        <div className="space-y-4">
          <div className="glass rounded-[var(--radius-lg)] p-5 md:p-6 h-64" />
          <div className="glass rounded-[var(--radius-lg)] p-5 md:p-6 h-48" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="glass rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4 h-20"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
