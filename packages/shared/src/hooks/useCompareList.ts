'use client';

import { createCompareListHook } from './createCompareListHook';

export interface CompareItem {
  id: string | number;
  title: string;
  imageUrl?: string | null;
  addedAt: number;
}

export const useCompareList = createCompareListHook<CompareItem>(
  'product_compare_list',
  4,
);

export default useCompareList;
