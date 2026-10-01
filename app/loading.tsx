export default function Loading() {
  return (
    <main className="planner-shell loading-shell" aria-label="Plan yükleniyor">
      <div className="skeleton skeleton-header" />
      <div className="week-grid">
        {Array.from({ length: 7 }, (_, i) => (
          <div className="skeleton skeleton-day" key={i} />
        ))}
      </div>
      <div className="skeleton skeleton-detail" />
    </main>
  );
}
