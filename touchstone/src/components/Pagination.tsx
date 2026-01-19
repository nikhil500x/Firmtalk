import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

// ============================================================================
// FULL PAGINATION COMPONENT
// ============================================================================

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage?: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
  showItemsPerPage?: boolean;
  itemsPerPageOptions?: number[];
  maxVisiblePages?: number;
}

export default function Pagination({
  currentPage,
  totalItems,
  itemsPerPage = 10,
  onPageChange,
  onItemsPerPageChange,
  showItemsPerPage = true,
  itemsPerPageOptions = [10, 25, 50, 100],
  maxVisiblePages = 10,
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getPageNumbers = (): (number | string)[] => {
    const pages: (number | string)[] = [];

    if (totalPages <= maxVisiblePages + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      let start = Math.max(2, currentPage - Math.floor(maxVisiblePages / 2));
      const end = Math.min(totalPages - 1, start + maxVisiblePages - 1);

      if (end === totalPages - 1) {
        start = Math.max(2, end - maxVisiblePages + 1);
      }

      if (start > 2) {
        pages.push("...");
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages - 1) {
        pages.push("...");
      }

      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
  };

  const handleItemsPerPageSelect = (value: string) => {
    const perPage = Number(value);
    onItemsPerPageChange?.(perPage);
  };

  if (totalItems === 0) return null;

  return (
    <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-white">
      {/* LEFT SIDE */}
      <div className="flex items-center gap-4">
        <div className="text-sm text-gray-600">
          Showing{" "}
          <span className="font-medium text-gray-900">{startItem}</span> to{" "}
          <span className="font-medium text-gray-900">{endItem}</span> of{" "}
          <span className="font-medium text-gray-900">{totalItems}</span>{" "}
          {totalItems === 1 ? "result" : "results"}
        </div>

        {showItemsPerPage && onItemsPerPageChange && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">
              Show:
            </label>

            <Select
              defaultValue={String(itemsPerPage)}
              onValueChange={handleItemsPerPageSelect}
            >
              <SelectTrigger className="w-[90px] h-[36px] text-sm">
                <SelectValue placeholder={itemsPerPage} />
              </SelectTrigger>

              <SelectContent>
                {itemsPerPageOptions.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* RIGHT SIDE */}
      <div className="flex items-center gap-2">
        {/* PREVIOUS */}
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 
                     disabled:opacity-50 disabled:cursor-not-allowed 
                     transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft size={18} className="text-gray-600" />
        </button>

        {/* PAGE NUMBERS */}
        <div className="flex items-center gap-1">
          {getPageNumbers().map((page, index) => (
            <React.Fragment key={index}>
              {page === "..." ? (
                <span className="px-3 py-1 text-gray-500 select-none">...</span>
              ) : (
                <button
                  onClick={() => handlePageChange(page as number)}
                  className={`min-w-[36px] px-3 py-1 rounded-md text-sm font-medium 
                             transition-colors ${
                               currentPage === page
                                 ? "bg-blue-600 text-white shadow-sm"
                                 : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                             }`}
                  aria-label={`Go to page ${page}`}
                  aria-current={currentPage === page ? "page" : undefined}
                >
                  {page}
                </button>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* NEXT */}
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 
                     disabled:opacity-50 disabled:cursor-not-allowed 
                     transition-colors"
          aria-label="Next page"
        >
          <ChevronRight size={18} className="text-gray-600" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// COMPACT PAGINATION
// ============================================================================

interface CompactPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function CompactPagination({
  currentPage,
  totalPages,
  onPageChange,
}: CompactPaginationProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-1.5 rounded border border-gray-300 hover:bg-gray-50 
                   disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        <ChevronLeft size={16} />
      </button>

      <span className="text-sm text-gray-600 px-2">
        Page <span className="font-medium">{currentPage}</span> of{" "}
        <span className="font-medium">{totalPages}</span>
      </span>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-1.5 rounded border border-gray-300 hover:bg-gray-50 
                   disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

// ============================================================================
// CUSTOM HOOK (usePagination)
// ============================================================================

export function usePagination(initialItemsPerPage = 10) {
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(initialItemsPerPage);

  const resetToFirstPage = React.useCallback(() => {
    setCurrentPage(1);
  }, []);

  const getPaginatedData = React.useCallback(<T,>(data: T[]): T[] => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  }, [currentPage, itemsPerPage]);

  return {
    currentPage,
    itemsPerPage,
    setCurrentPage,
    setItemsPerPage,
    resetToFirstPage,
    getPaginatedData,
  };
}
