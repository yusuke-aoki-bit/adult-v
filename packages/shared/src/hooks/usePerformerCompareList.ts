'use client';

import { createCompareListHook } from './createCompareListHook';

export interface PerformerCompareItem {
  id: string | number;
  name: string;
  imageUrl?: string | null;
  productCount?: number;
  addedAt: number;
}

export const usePerformerCompareList = createCompareListHook<PerformerCompareItem>('performer_compare_list', 4);

export default usePerformerCompareList;
