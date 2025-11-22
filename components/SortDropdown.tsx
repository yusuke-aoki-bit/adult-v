'use client';

import { useRouter, useSearchParams } from 'next/navigation';

interface SortDropdownProps {
  sortBy: 'nameAsc' | 'nameDesc' | 'productCountDesc' | 'productCountAsc' | 'recent';
}

export default function SortDropdown({ sortBy }: SortDropdownProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSortChange = (newSort: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', newSort);
    params.delete('page'); // Reset to page 1 when sorting changes
    router.push(`/?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort" className="text-sm font-medium text-gray-700">
        並び順:
      </label>
      <select
        id="sort"
        name="sort"
        value={sortBy}
        onChange={(e) => handleSortChange(e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-rose-500 focus:border-green-500"
      >
        <option value="nameAsc">名前順（あ→ん）</option>
        <option value="nameDesc">名前順（ん→あ）</option>
        <option value="productCountDesc">作品数順（多い順）</option>
        <option value="productCountAsc">作品数順（少ない順）</option>
        <option value="recent">新着順</option>
      </select>
    </div>
  );
}
