import { Actress } from '@/types/product';
import { apexProducts } from '@/lib/providers/apex';

/**
 * APEXのCSVデータから女優名を抽出して、ユニークな女優リストを生成
 */
function extractUniqueActressNames(): Map<string, { name: string; productCount: number }> {
  const actressMap = new Map<string, { name: string; productCount: number }>();

  apexProducts.forEach((product) => {
    if (product.actressName && product.actressName !== '---') {
      const name = product.actressName.trim();
      if (name) {
        const existing = actressMap.get(name);
        if (existing) {
          existing.productCount += 1;
        } else {
          actressMap.set(name, { name, productCount: 1 });
        }
      }
    }
  });

  return actressMap;
}

/**
 * 女優名からIDを生成（プロバイダープレフィックスなし）
 */
function generateActressId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\u3040-\u30ff\u4e00-\u9faf]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * 女優名からサムネイル画像URLを生成（プレースホルダー）
 */
function generateActressThumbnail(name: string): string {
  // 最初の2文字を使用してプレースホルダーを生成
  const initials = name.slice(0, 2);
  return `https://placehold.co/400x520/052e16/ffffff?text=${encodeURIComponent(initials)}`;
}

/**
 * 作品数に基づいてジャンルを推定
 */
function inferGenres(productCount: number, products: typeof apexProducts): string[] {
  const genres: string[] = [];
  
  if (productCount >= 20) {
    genres.push('premium');
  }
  if (productCount >= 10) {
    genres.push('indies');
  }
  
  // 実際の作品のカテゴリから推測
  const categoryCounts = new Map<string, number>();
  products.forEach((p) => {
    if (p.category) {
      categoryCounts.set(p.category, (categoryCounts.get(p.category) || 0) + 1);
    }
  });
  
  const topCategory = Array.from(categoryCounts.entries())
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  
  if (topCategory && !genres.includes(topCategory)) {
    genres.push(topCategory);
  }
  
  return genres.length > 0 ? genres : ['premium'];
}

/**
 * APEXのCSVデータから女優データを生成
 */
export function generateActressesFromApex(): Actress[] {
  const actressMap = extractUniqueActressNames();
  const actresses: Actress[] = [];

  actressMap.forEach(({ name, productCount }, key) => {
    const actressId = generateActressId(name);
    const products = apexProducts.filter((p) => p.actressName === name);
    const genres = inferGenres(productCount, products);

    // トレンドスコアを作品数に基づいて計算
    const trendingScore = Math.min(100, 50 + productCount * 2);
    const fanScore = Math.min(100, 60 + productCount * 1.5);

    actresses.push({
      id: actressId,
      name,
      catchcopy: productCount >= 10 ? '人気女優' : productCount >= 5 ? '注目の女優' : '新進女優',
      description: `${productCount}作品をリリース。`,
      heroImage: generateActressThumbnail(name),
      thumbnail: generateActressThumbnail(name),
      primaryGenres: genres.slice(0, 3) as any,
      services: ['duga'],
      metrics: {
        releaseCount: productCount,
        trendingScore: Math.round(trendingScore),
        fanScore: Math.round(fanScore),
      },
      highlightWorks: products.slice(0, 3).map((p) => p.id),
      tags: productCount >= 20 ? ['人気', '多数作品'] : productCount >= 10 ? ['注目'] : [],
    });
  });

  // 作品数でソート（多い順）
  return actresses.sort((a, b) => b.metrics.releaseCount - a.metrics.releaseCount);
}


