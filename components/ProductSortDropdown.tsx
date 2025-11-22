'use client';

import { useRouter, useSearchParams } from 'next/navigation';

interface ProductSortDropdownProps {
  sortBy: string;
  basePath: string;
}

export default function ProductSortDropdown({ sortBy, basePath }: ProductSortDropdownProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSortChange = (newSort: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', newSort);
    params.delete('page'); // Reset to page 1 when sorting changes
    router.push(`${basePath}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="product-sort" className="text-sm font-medium text-gray-700">
        並び順:
      </label>
      <select
        id="product-sort"
        name="sort"
        value={sortBy}
        onChange={(e) => handleSortChange(e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-rose-500 focus:border-green-500"
      >
        <option value="releaseDateDesc">新しい順</option>
        <option value="releaseDateAsc">古い順</option>
        <option value="priceAsc">価格が安い順</option>
        <option value="priceDesc">価格が高い順</option>
        <option value="titleAsc">タイトル順</option>
      </select>
    </div>
  );
}
