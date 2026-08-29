'use client';

import type { RankingPagination } from '@/lib/ranking-api';

type RankingPaginationBarProps = {
  pagination: RankingPagination | null;
  onPageChange: (page: number) => void;
  loading?: boolean;
};

export default function RankingPaginationBar({
  pagination,
  onPageChange,
  loading = false,
}: RankingPaginationBarProps) {
  if (!pagination || pagination.totalPages <= 1) return null;

  const { page, totalPages, total, limit } = pagination;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="we-rank-pagination">
      <button
        type="button"
        className="we-btn we-rank-page-btn"
        disabled={page <= 1 || loading}
        onClick={() => onPageChange(page - 1)}
      >
        ← Trước
      </button>
      <span className="we-rank-page-info">
        Trang {page}/{totalPages} · {from}–{to} / {total.toLocaleString()}
      </span>
      <button
        type="button"
        className="we-btn we-rank-page-btn"
        disabled={page >= totalPages || loading}
        onClick={() => onPageChange(page + 1)}
      >
        Sau →
      </button>
    </div>
  );
}
