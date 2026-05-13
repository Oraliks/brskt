/**
 * Décor de fond de la landing : 3 blobs gradient flottants + grain.
 * Server component, CSS-only (animations CSS).
 */
export function MeshBackground() {
  return (
    <>
      <div className="mesh-bg pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="mesh-blob blob-1" />
        <div className="mesh-blob blob-2" />
        <div className="mesh-blob blob-3" />
      </div>
      <div className="grain pointer-events-none fixed inset-0 -z-10 opacity-[0.04]" />
    </>
  );
}
