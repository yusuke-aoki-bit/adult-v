'use client';

import { useEffect } from 'react';

interface ViewTrackerProps {
  productId?: number;
  performerId?: number;
}

export default function ViewTracker({ productId, performerId }: ViewTrackerProps) {
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
  }, [productId, performerId]);

  // This component doesn't render anything
  return null;
}
