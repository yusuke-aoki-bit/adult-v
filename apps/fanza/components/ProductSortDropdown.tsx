'use client';

import { useRouter, useSearchParams, useParams } from 'next/navigation';

// Client-side translations
const translations = {
  ja: {
    sortLabel: '並び順:',
    releaseDateDesc: '新しい順',
    releaseDateAsc: '古い順',
    priceAsc: '価格が安い順',
    priceDesc: '価格が高い順',
    ratingDesc: '評価が高い順',
    reviewCountDesc: 'レビュー数順',
    durationDesc: '再生時間が長い順',
    durationAsc: '再生時間が短い順',
    titleAsc: 'タイトル順',
    random: 'ランダム',
  },
  en: {
    sortLabel: 'Sort:',
    releaseDateDesc: 'Newest First',
    releaseDateAsc: 'Oldest First',
    priceAsc: 'Price: Low to High',
    priceDesc: 'Price: High to Low',
    ratingDesc: 'Highest Rated',
    reviewCountDesc: 'Most Reviews',
    durationDesc: 'Longest Duration',
    durationAsc: 'Shortest Duration',
    titleAsc: 'Title (A-Z)',
    random: 'Random',
  },
  zh: {
    sortLabel: '排序:',
    releaseDateDesc: '最新优先',
    releaseDateAsc: '最早优先',
    priceAsc: '价格：从低到高',
    priceDesc: '价格：从高到低',
    ratingDesc: '评分最高',
    reviewCountDesc: '评论最多',
    durationDesc: '时长最长',
    durationAsc: '时长最短',
    titleAsc: '标题 (A-Z)',
    random: '随机',
  },
  ko: {
    sortLabel: '정렬:',
    releaseDateDesc: '최신순',
    releaseDateAsc: '오래된순',
    priceAsc: '가격: 낮은순',
    priceDesc: '가격: 높은순',
    ratingDesc: '평점 높은순',
    reviewCountDesc: '리뷰 많은순',
    durationDesc: '재생시간 긴순',
    durationAsc: '재생시간 짧은순',
    titleAsc: '제목순 (가나다)',
    random: '랜덤',
  },
} as const;

interface ProductSortDropdownProps {
  sortBy: string;
  basePath: string;
}

export default function ProductSortDropdown({ sortBy, basePath }: ProductSortDropdownProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const t = translations[locale as keyof typeof translations] || translations.ja;

  const handleSortChange = (newSort: string) => {
    const urlParams = new URLSearchParams(searchParams.toString());
    urlParams.set('sort', newSort);
    urlParams.delete('page'); // Reset to page 1 when sorting changes
    router.push(`${basePath}?${urlParams.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="product-sort" className="text-sm font-medium text-gray-600">
        {t.sortLabel}
      </label>
      <select
        id="product-sort"
        name="sort"
        value={sortBy}
        onChange={(e) => handleSortChange(e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:ring-pink-500 focus:border-pink-500"
      >
        <option value="releaseDateDesc">{t.releaseDateDesc}</option>
        <option value="releaseDateAsc">{t.releaseDateAsc}</option>
        <option value="priceAsc">{t.priceAsc}</option>
        <option value="priceDesc">{t.priceDesc}</option>
        <option value="ratingDesc">{t.ratingDesc}</option>
        <option value="reviewCountDesc">{t.reviewCountDesc}</option>
        <option value="durationDesc">{t.durationDesc}</option>
        <option value="durationAsc">{t.durationAsc}</option>
        <option value="titleAsc">{t.titleAsc}</option>
        <option value="random">{t.random}</option>
      </select>
    </div>
  );
}
