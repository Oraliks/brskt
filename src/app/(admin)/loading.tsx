/**
 * Skeleton de chargement pour les pages admin.
 * Reproduit grossièrement la grille de KPIs + table que la plupart des
 * pages admin affichent, pour un loading state moins brutal qu'un spinner.
 */
export default function AdminLoading() {
  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto animate-pulse">
      {/* Header */}
      <div className="mb-6 flex items-end justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="h-7 w-48 rounded bg-[var(--color-surface-tint)] mb-2" />
          <div className="h-4 w-72 rounded bg-[var(--color-surface-tint)]" />
        </div>
        <div className="h-8 w-32 rounded bg-[var(--color-surface-tint)]" />
      </div>

      {/* KPI cards row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="glass rounded-[var(--radius-lg)] p-4 h-24"
          >
            <div className="h-3 w-24 rounded bg-[var(--color-surface-tint)] mb-3" />
            <div className="h-7 w-16 rounded bg-[var(--color-surface-tint-strong)]" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="glass rounded-[var(--radius-lg)] p-3">
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[1.4fr_1fr_1fr_1fr_0.6fr] gap-3 items-center py-2"
            >
              <div className="h-4 w-3/4 rounded bg-[var(--color-surface-tint)]" />
              <div className="h-4 w-1/2 rounded bg-[var(--color-surface-tint)]" />
              <div className="h-4 w-1/2 rounded bg-[var(--color-surface-tint)]" />
              <div className="h-4 w-2/3 rounded bg-[var(--color-surface-tint)]" />
              <div className="h-6 w-16 rounded bg-[var(--color-surface-tint-strong)] justify-self-end" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
