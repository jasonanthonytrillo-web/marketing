export default function PaginationControls({ page, totalPages, total, itemCount, onPageChange }) {
  if (!totalPages || totalPages <= 1) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-4 border-t border-surface-100 bg-surface-50/40">
      <p className="text-xs font-semibold text-surface-500">
        Showing {itemCount} of {total} records
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-2 rounded-lg border border-surface-200 bg-white text-xs font-bold text-surface-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-100 transition-colors"
        >
          Previous
        </button>
        <span className="px-2 text-xs font-black text-surface-600">Page {page} of {totalPages}</span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-2 rounded-lg border border-surface-200 bg-white text-xs font-bold text-surface-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-100 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
