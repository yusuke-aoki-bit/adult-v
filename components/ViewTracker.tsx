'use client';

import { useEffect } from 'react';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';

interface ViewTrackerProps {
  productId?: number;
  performerId?: number;
  // 最近見た作品履歴用のプロパティ
  productData?: {
    id: string;
    title: string;
    imageUrl: string | null;
    aspName: string;
  };
}

export default function ViewTracker({ productId, performerId, productData }: ViewTrackerProps) {
  const { addItem } = useRecentlyViewed();

  useEffect(() => {
    // Track view on mount
    const trackView = async () => {
      try {
        await fetch('/api/track/view', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            productId,
            performerId,
          }),
        });
      } catch (error) {
        // Silently fail - tracking is not critical
        console.debug('Failed to track view:', error);
      }
    };

    trackView();

    // 最近見た作品に追加
    if (productData) {
      addItem(productData);
    }
  }, [productId, performerId, productData, addItem]);

  // This component doesn't render anything
  return null;
}
