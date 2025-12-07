import { Metadata } from 'next';

const siteName = 'Adult Viewer Lab';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';
const defaultDescription =
  '複数のプラットフォームを横断し、ヘビー視聴者向けに女優・ジャンル別のレビュー、ランキング、キャンペーン速報を届けるアフィリエイトサイト。';

/**
 * SEO最適化されたメタディスクリプションを生成（150-160文字に制限）
 */
export function generateOptimizedDescription(
  title: string,
  actressName?: string,
  tags?: string[],
  releaseDate?: string,
  productId?: string,
): string {
  const parts: string[] = [];

  if (actressName) {
    parts.push(`${actressName}出演`);
  }

  if (title) {
    const maxTitleLength = 80;
    const trimmedTitle = title.length > maxTitleLength
      ? title.substring(0, maxTitleLength) + '...'
      : title;
    parts.push(trimmedTitle);
  }

  if (tags && tags.length > 0) {
    const genres = tags.slice(0, 3).join('・');
    parts.push(`【${genres}】`);
  }

  if (releaseDate) {
    parts.push(`配信日: ${releaseDate}`);
  }

  if (productId) {
    parts.push(`品番: ${productId}`);
  }

  const description = parts.join(' | ');
  return description.length > 160
    ? description.substring(0, 157) + '...'
    : description;
}

// SEO向けキーワード（多言語対応）
const localeKeywords = {
  ja: [
    'アダルト動画',
    'AV女優',
    '女優ランキング',
    'アダルト配信',
    'DUGA',
    'MGS',
    'DTI',
    'SOKMIL',
    '動画レビュー',
    'アダルトサイト比較',
    '新作AV',
    'セール情報',
    'アダルトキャンペーン',
    '無修正動画',
    'カリビアンコム',
    '一本道',
    'HEYZO',
  ],
  en: [
    'adult videos',
    'JAV actresses',
    'actress rankings',
    'adult streaming',
    'DUGA',
    'MGS',
    'DTI',
    'SOKMIL',
    'video reviews',
    'adult site comparison',
    'new releases',
    'sales information',
    'adult campaigns',
    'uncensored videos',
    'Caribbeancom',
    '1Pondo',
    'HEYZO',
  ],
  zh: [
    '成人影片',
    'AV女優',
    '女優排名',
    '成人影音',
    'DUGA',
    'MGS',
    'DTI',
    'SOKMIL',
    '影片评论',
    '成人网站比较',
    '新片发布',
    '优惠信息',
    '成人活动',
    '无码影片',
    '加勒比海',
    '一本道',
    'HEYZO',
  ],
  ko: [
    '성인 비디오',
    'AV 여배우',
    '여배우 랭킹',
    '성인 스트리밍',
    'DUGA',
    'MGS',
    'DTI',
    'SOKMIL',
    '비디오 리뷰',
    '성인 사이트 비교',
    '신작 출시',
    '세일 정보',
    '성인 캠페인',
    '무수정 비디오',
    '카리비안컴',
    '잇폰도',
    'HEYZO',
  ],
};

const defaultKeywords = localeKeywords.ja;

/**
 * ロケールマッピング（OpenGraph用）
 */
const localeMap: Record<string, string> = {
  ja: 'ja_JP',
  en: 'en_US',
  zh: 'zh_CN',
  ko: 'ko_KR',
};

/**
 * ベースのメタタグを生成（多言語対応）
 */
export function generateBaseMetadata(
  title: string,
  description?: string,
  image?: string,
  path?: string,
  keywords?: string[],
  locale: string = 'ja',
): Metadata {
  const pageTitle = `${title} | ${siteName}`;
  const pageDescription = description || defaultDescription;
  const pageUrl = path ? `${siteUrl}${path}` : siteUrl;
  // デフォルトOGP画像のパスを設定（publicフォルダ内）
  const pageImage = image || `${siteUrl}/og-image.jpg`;
  const pageKeywords = keywords || localeKeywords[locale as keyof typeof localeKeywords] || defaultKeywords;
  const ogLocale = localeMap[locale] || 'ja_JP';

  return {
    title: pageTitle,
    description: pageDescription,
    keywords: pageKeywords.join(', '),
    alternates: {
      canonical: pageUrl,
      languages: {
        'ja': `${siteUrl}/ja${path || ''}`,
        'en': `${siteUrl}/en${path || ''}`,
        'zh': `${siteUrl}/zh${path || ''}`,
        'ko': `${siteUrl}/ko${path || ''}`,
        'x-default': `${siteUrl}/ja${path || ''}`,
      },
    },
    openGraph: {
      title: pageTitle,
      description: pageDescription,
      url: pageUrl,
      siteName,
      images: [
        {
          url: pageImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: ogLocale,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description: pageDescription,
      images: [pageImage],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    other: {
      'google-site-verification': process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || '',
    },
  };
}

/**
 * 構造化データ: WebSite（多言語対応）
 */
export function generateWebSiteSchema(locale: string = 'ja') {
  const localeDescriptions: Record<string, string> = {
    ja: '複数のプラットフォームを横断し、ヘビー視聴者向けに女優・ジャンル別のレビュー、ランキング、キャンペーン速報を届けるアフィリエイトサイト。',
    en: 'Cross-platform adult streaming hub covering DUGA, MGS, DTI with actress-based reviews, rankings, and campaign updates for heavy users.',
    zh: '跨平台成人影音中心，涵盖DUGA、MGS、DTI，提供基于女优的评论、排名和活动更新，专为重度用户打造。',
    ko: '여러 플랫폼을 아우르는 성인 스트리밍 허브로, DUGA, MGS, DTI를 다루며 헤비 유저를 위한 여배우 기반 리뷰, 랭킹 및 캠페인 업데이트를 제공합니다.',
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    alternateName: 'アダルトビューアーラボ',
    url: siteUrl,
    description: localeDescriptions[locale] || localeDescriptions.ja,
    inLanguage: ['ja', 'en', 'zh', 'ko'],
    publisher: {
      '@type': 'Organization',
      name: siteName,
      url: siteUrl,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/${locale}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * 構造化データ: BreadcrumbList
 */
export function generateBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${siteUrl}${item.url}`,
    })),
  };
}

/**
 * 構造化データ: Person（女優）
 */
export function generatePersonSchema(
  name: string,
  description: string,
  image: string,
  url: string,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    description,
    image,
    url: `${siteUrl}${url}`,
  };
}

/**
 * 構造化データ: Product（商品）
 */
export function generateProductSchema(
  name: string,
  description: string,
  image: string,
  url: string,
  price?: number,
  brand?: string,
  aggregateRating?: {
    ratingValue: number;
    reviewCount: number;
  },
  salePrice?: number,
  currency: string = 'JPY',
) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    image,
    url: `${siteUrl}${url}`,
  };

  if (brand) {
    schema.brand = {
      '@type': 'Brand',
      name: brand,
    };
  }

  if (price !== undefined || salePrice !== undefined) {
    const offerPrice = salePrice ?? price;
    const offer: Record<string, unknown> = {
      '@type': 'Offer',
      price: offerPrice,
      priceCurrency: currency,
      availability: 'https://schema.org/InStock',
    };

    // セール価格がある場合、元の価格と割引情報を追加
    if (salePrice && price && salePrice < price) {
      offer.priceValidUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 30日後
    }

    schema.offers = offer;
  }

  if (aggregateRating) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: aggregateRating.ratingValue,
      reviewCount: aggregateRating.reviewCount,
    };
  }

  return schema;
}

/**
 * 構造化データ: VideoObject（動画商品）
 */
export function generateVideoObjectSchema(
  name: string,
  description: string,
  thumbnailUrl: string,
  url: string,
  duration?: number,
  uploadDate?: string,
) {
  const schema: any = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name,
    description,
    thumbnailUrl,
    contentUrl: url,
    embedUrl: url,
  };

  if (duration) {
    schema.duration = `PT${Math.round(duration)}M`;
  }

  if (uploadDate) {
    schema.uploadDate = uploadDate;
  }

  return schema;
}

/**
 * 構造化データ: ItemList（女優一覧など）
 */
export function generateItemListSchema(items: { name: string; url: string }[], listName: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: listName,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${siteUrl}${item.url}`,
    })),
  };
}


