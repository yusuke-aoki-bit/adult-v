import { Metadata } from 'next';

const siteName = 'Adult Viewer Lab';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';
const defaultDescription =
  '複数のプラットフォームを横断し、ヘビー視聴者向けに女優・ジャンル別のレビュー、ランキング、キャンペーン速報を届けるアフィリエイトサイト。';

// SEO向けキーワード
const defaultKeywords = [
  'アダルト動画',
  'AV女優',
  '女優ランキング',
  'アダルト配信',
  'DMM',
  'DUGA',
  'MGS',
  'DTI',
  'FANZA',
  '動画レビュー',
  'アダルトサイト比較',
  '新作AV',
  'セール情報',
  'アダルトキャンペーン',
];

/**
 * ベースのメタタグを生成
 */
export function generateBaseMetadata(
  title: string,
  description?: string,
  image?: string,
  path?: string,
  keywords?: string[],
): Metadata {
  const pageTitle = `${title} | ${siteName}`;
  const pageDescription = description || defaultDescription;
  const pageUrl = path ? `${siteUrl}${path}` : siteUrl;
  const pageImage = image || `${siteUrl}/og-image.jpg`;
  const pageKeywords = keywords || defaultKeywords;

  return {
    title: pageTitle,
    description: pageDescription,
    keywords: pageKeywords.join(', '),
    alternates: {
      canonical: pageUrl,
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
      locale: 'ja_JP',
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
 * 構造化データ: WebSite
 */
export function generateWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    alternateName: 'アダルトビューアーラボ',
    url: siteUrl,
    description: defaultDescription,
    inLanguage: ['ja', 'en', 'zh'],
    publisher: {
      '@type': 'Organization',
      name: siteName,
      url: siteUrl,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/ja/search?q={search_term_string}`,
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
) {
  const schema: any = {
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

  if (price !== undefined) {
    schema.offers = {
      '@type': 'Offer',
      price,
      priceCurrency: 'JPY',
      availability: 'https://schema.org/InStock',
    };
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


