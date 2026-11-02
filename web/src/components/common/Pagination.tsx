import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { fieldClass } from '../ui';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage: number;
  totalItems: number;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
}

export const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
  totalItems,
  onItemsPerPageChange,
}: PaginationProps) => {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  if (totalPages <= 1) {
    return null;
  }

  const navBtn = 'w-9 h-9 inline-flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 px-4 py-3 bg-white rounded-xl border border-gray-200">
      {/* Rango mostrado */}
      <div className="text-sm text-gray-500">
        <span className="font-medium text-gray-900">{startItem}</span>–<span className="font-medium text-gray-900">{endItem}</span> de{' '}
        <span className="font-medium text-gray-900">{totalItems}</span> productos
      </div>

      {/* Páginas */}
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onPageChange(1)} disabled={currentPage === 1} className={`${navBtn} hidden sm:inline-flex`} aria-label="Primera página" title="Primera página">
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className={navBtn} aria-label="Página anterior" title="Página anterior">
          <ChevronLeft className="w-4 h-4" />
        </button>

        {getPageNumbers().map((page, index) =>
          page === '...' ? (
            <span key={`ellipsis-${index}`} className="px-1 text-gray-400">…</span>
          ) : (
            <button
              type="button"
              key={page}
              onClick={() => onPageChange(page as number)}
              aria-current={currentPage === page ? 'page' : undefined}
              className={`min-w-[36px] h-9 px-2 rounded-lg text-sm font-medium transition-colors ${
                currentPage === page ? 'bg-app-600 text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {page}
            </button>
          ),
        )}

        <button type="button" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className={navBtn} aria-label="Página siguiente" title="Página siguiente">
          <ChevronRight className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} className={`${navBtn} hidden sm:inline-flex`} aria-label="Última página" title="Última página">
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>

      {/* Por página */}
      {onItemsPerPageChange && (
        <label className="flex items-center gap-2 text-sm text-gray-500">
          Por página
          <select
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
            className={`${fieldClass()} h-9 w-20`}
          >
            <option value={8}>8</option>
            <option value={12}>12</option>
            <option value={16}>16</option>
            <option value={24}>24</option>
          </select>
        </label>
      )}
    </div>
  );
};
