'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFavorites, type FavoriteItem } from './useFavorites';

export interface EnrichedProduct extends FavoriteItem {
  price?: number | null;
  salePrice?: number | null;
  discount?: number | null;
  saleEndDate?: string | null;
  provider?: string | null;
  duration?: number | null;
}

export function useWatchlistAnalysis() {
  const { favorites, isLoaded, getFavoritesByType } = useFavorites();
  const [enrichedProducts, setEnrichedProducts] = useState<EnrichedProduct[]>([]);
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);

  const productFavorites = useMemo(() => {
    return getFavoritesByType('product');
  }, [getFavoritesByType]);

  // Fetch enriched product data (prices, sale info) when favorites change
  useEffect(() => {
    const fetchEnrichedData = async () => {
      if (!isLoaded || productFavorites.length === 0) {
        setEnrichedProducts([]);
        return;
      }

      setIsLoadingPrices(true);

      try {
        // Get product IDs
        const productIds = productFavorites.map(p => String(p.id));

        // Fetch current prices from API
        const response = await fetch('/api/products/prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productIds }),
        });

        if (response.ok) {
          const priceData = await response.json() as Record<string, {
            price: number;
            salePrice: number | null;
            discount: number | null;
            saleEndDate: string | null;
            provider: string;
            duration: number | null;
          }>;

          // Merge price data with favorites
          const enriched = productFavorites.map(product => ({
            ...product,
            ...priceData[String(product.id)],
          }));

          setEnrichedProducts(enriched);
        } else {
          // If API fails, use favorites without price data
          setEnrichedProducts(productFavorites);
        }
      } catch (error) {
        console.error('Failed to fetch price data:', error);
        setEnrichedProducts(productFavorites);
      } finally {
        setIsLoadingPrices(false);
      }
    };

    fetchEnrichedData();
  }, [productFavorites, isLoaded]);

  // Calculate statistics
  const stats = useMemo(() => {
    const productsWithPrice = enrichedProducts.filter(p => p.price !== undefined);

    const totalRegularPrice = productsWithPrice.reduce((sum, p) => sum + (p.price || 0), 0);
    const totalSalePrice = productsWithPrice.reduce(
      (sum, p) => sum + (p.salePrice || p.price || 0), 0
    );
    const totalSavings = totalRegularPrice - totalSalePrice;
    const onSaleCount = enrichedProducts.filter(p => p.salePrice).length;

    // Count urgent items (sale ending in 3 days or less)
    const now = new Date();
    const urgentCount = enrichedProducts.filter(p => {
      if (!p.saleEndDate) return false;
      const end = new Date(p.saleEndDate);
      const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= 3 && diffDays >= 0;
    }).length;

    return {
      totalCount: enrichedProducts.length,
      totalRegularPrice,
      totalSalePrice,
      totalSavings,
      onSaleCount,
      urgentCount,
    };
  }, [enrichedProducts]);

  return {
    products: enrichedProducts,
    stats,
    isLoading: !isLoaded || isLoadingPrices,
    productCount: productFavorites.length,
  };
}
