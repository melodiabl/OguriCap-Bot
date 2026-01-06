export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-2">
          <div className="skeleton h-6 w-56 rounded-lg" />
          <div className="skeleton h-4 w-80 rounded-lg" />
        </div>
        <div className="flex items-center gap-3">
          <div className="skeleton h-9 w-32 rounded-full" />
          <div className="skeleton h-9 w-28 rounded-xl" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="ultra-card p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="skeleton h-4 w-24 rounded" />
              <div className="skeleton h-10 w-10 rounded-xl" />
            </div>
            <div className="skeleton h-8 w-20 rounded mb-2" />
            <div className="skeleton h-3 w-32 rounded" />
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="ultra-card overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <div className="skeleton h-5 w-40 rounded mb-2" />
          <div className="skeleton h-4 w-56 rounded" />
        </div>
        <div className="p-6 space-y-3">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="flex items-center gap-4">
              <div className="skeleton h-4 flex-1 rounded" />
              <div className="skeleton h-4 w-24 rounded" />
              <div className="skeleton h-4 w-20 rounded" />
              <div className="skeleton h-8 w-28 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
