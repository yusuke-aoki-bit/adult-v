import { Metadata } from 'next';

// サイト設定（各サイトで上書き可能）
let siteConfig = {
  siteName: 'Adult Viewer Lab',
  alternateName: 'アダルトビューアーラボ',
  defaultDescription: '複数のプラットフォームを横断し、ヘビー視聴者向けに女優・ジャンル別のレビュー、ランキング、キャンペーン速報を届けるアフィリエイトサイト。',
};

/**
 * サイト設定を更新
 */
export function setSeoConfig(config: Partial<typeof siteConfig>) {
  siteConfig = { ...siteConfig, ...config };
}

/**
 * 現在のサイト設定を取得
 */
export function getSeoConfig() {
  return { ...siteConfig };
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

/**
 * SEO最適化されたメタディスクリプションを生成（150-160文字に制限）
 * セール商品や高評価商品は優先的に表示してCTR向上
 */
export function generateOptimizedDescription(
  title: string,
  actressName?: string,
  tags?: string[],
  releaseDate?: string,
  productId?: string,
  options?: {
    salePrice?: number;
    regularPrice?: number;
    discount?: number;
    rating?: number;
    reviewCount?: number;
  },
): string {
  const parts: string[] = [];

  // セール情報を最優先で表示（CTR向上）
  if (options?.salePrice && options?.regularPrice && options.discount) {
    parts.push(`[SALE] ${options.discount}%OFF`);
  }

  // 高評価商品は星を表示
  if (options?.rating && options.rating >= 4.0 && options?.reviewCount && options.reviewCount >= 5) {
    parts.push(`★${options.rating.toFixed(1)}(${options.reviewCount}件)`);
  }

  if (actressName) {
    parts.push(`${actressName}出演`);
  }

  if (title) {
    const maxTitleLength = 60; // セール/評価情報を入れる分短くする
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
  const { siteName, defaultDescription } = siteConfig;
  const pageTitle = `${title} | ${siteName}`;
  const pageDescription = description || defaultDescription;
  const pageUrl = path ? `${siteUrl}${path}` : siteUrl;
  // デフォルトOGP画像のパスを設定（publicフォルダ内）
  const pageImage = image || `${siteUrl}/og-image.jpg`;
  const pageKeywords = keywords || localeKeywords[locale as keyof typeof localeKeywords] || defaultKeywords;
  const ogLocale = localeMap[locale] || 'ja_JP';

  // pathからlocale部分を除去してbasePathを取得
  // 例: /ja/actress/123 → /actress/123
  // 例: /en → '' (ルートページ)
  const localePattern = /^\/(ja|en|zh|ko)(\/|$)/;
  const basePath = path ? path.replace(localePattern, '/').replace(/^\/$/, '') : '';

  return {
    title: pageTitle,
    description: pageDescription,
    keywords: pageKeywords.join(', '),
    alternates: {
      canonical: pageUrl,
      languages: {
        'ja': `${siteUrl}/ja${basePath}`,
        'en': `${siteUrl}/en${basePath}`,
        'zh': `${siteUrl}/zh${basePath}`,
        'ko': `${siteUrl}/ko${basePath}`,
        'x-default': pageUrl, // canonical と一致させてSEO警告を回避
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
  const { siteName, alternateName, defaultDescription } = siteConfig;
  const localeDescriptions: Record<string, string> = {
    ja: defaultDescription,
    en: 'Cross-platform adult streaming hub covering DUGA, MGS, DTI with actress-based reviews, rankings, and campaign updates for heavy users.',
    zh: '跨平台成人影音中心，涵盖DUGA、MGS、DTI，提供基于女优的评论、排名和活动更新，专为重度用户打造。',
    ko: '여러 플랫폼을 아우르는 성인 스트리밍 허브로, DUGA, MGS, DTI를 다루며 헤비 유저를 위한 여배우 기반 리뷰, 랭킹 및 캠페인 업데이트를 제공합니다.',
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    alternateName,
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
        urlTemplate: `${siteUrl}/${locale}/products?q={search_term_string}`,
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
 * SEO最適化: jobTitle, workCount, デビュー年などを追加
 */
export function generatePersonSchema(
  name: string,
  description: string,
  image: string,
  url: string,
  options?: {
    workCount?: number;
    debutYear?: number;
    aliases?: string[];
  },
) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    description: description || `${name}の作品一覧、出演情報、プロフィールをご覧いただけます。`,
    image,
    url: `${siteUrl}${url}`,
    jobTitle: 'AV女優',
  };

  // 別名（aliases）がある場合
  if (options?.aliases && options.aliases.length > 0) {
    schema.alternateName = options.aliases;
  }

  // 作品数がある場合
  if (options?.workCount && options.workCount > 0) {
    schema.knowsAbout = `${options.workCount}作品以上に出演`;
  }

  // デビュー年がある場合
  if (options?.debutYear) {
    schema.birthDate = `${options.debutYear}`;
  }

  return schema;
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
  sku?: string,
) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    image,
    url: `${siteUrl}${url}`,
  };

  if (sku) {
    schema.sku = sku;
    schema.productID = sku;
  }

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

  // aggregateRatingが有効な場合のみ追加（ratingValue > 0 かつ reviewCount > 0）
  if (aggregateRating && aggregateRating.ratingValue > 0 && aggregateRating.reviewCount > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: aggregateRating.ratingValue,
      bestRating: 5,
      worstRating: 1,
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
  const schema: Record<string, unknown> = {
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

/**
 * 構造化データ: FAQPage（よくある質問）
 * リッチリザルト表示でCTR向上を狙う
 */
export function generateFAQSchema(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/**
 * ホームページ用FAQ（多言語対応）
 * Googleリッチリザルトに表示されCTR向上を狙う
 */
export function getHomepageFAQs(locale: string = 'ja'): { question: string; answer: string }[] {
  const { siteName } = siteConfig;
  const faqsByLocale: Record<string, { question: string; answer: string }[]> = {
    ja: [
      {
        question: `${siteName}とは何ですか？`,
        answer: `${siteName}は、DUGA、MGS、SOKMIL、カリビアンコム、一本道、HEYZOなど主要アダルト動画配信サイトを横断検索できるサービスです。38,000名以上のAV女優情報、出演作品の価格比較、無料サンプル動画へのリンクを提供しています。`,
      },
      {
        question: 'どのような配信サイトに対応していますか？',
        answer: 'DUGA、MGS（PRESTIGE・S1・Ideapocket等）、SOKMIL、カリビアンコム、カリビアンコムプレミアム、一本道、HEYZO、天然むすめ、パコパコママ、FC2コンテンツマーケット、Japanskaなど主要サイトに対応しています。',
      },
      {
        question: '無料で利用できますか？',
        answer: `はい、${siteName}は完全無料でご利用いただけます。女優検索、作品検索、価格比較、無料サンプル動画の視聴など全ての機能を無料でお使いいただけます。`,
      },
      {
        question: 'セール情報はどこで確認できますか？',
        answer: 'トップページのセールセクション、または作品一覧ページの「セール中のみ」フィルターで確認できます。各配信サイトの最新セール情報をリアルタイムで収集しています。',
      },
    ],
    en: [
      {
        question: `What is ${siteName}?`,
        answer: `${siteName} is a cross-platform search service for major adult video streaming sites including DUGA, MGS, SOKMIL, Caribbeancom, 1Pondo, and HEYZO. We provide information on over 38,000 JAV actresses, price comparisons, and links to free sample videos.`,
      },
      {
        question: 'Which streaming sites are supported?',
        answer: 'We support DUGA, MGS (PRESTIGE, S1, Ideapocket, etc.), SOKMIL, Caribbeancom, Caribbeancom Premium, 1Pondo, HEYZO, 10musume, Pacopacomama, FC2 Content Market, Japanska, and more.',
      },
      {
        question: 'Is it free to use?',
        answer: `Yes, ${siteName} is completely free to use. All features including actress search, product search, price comparison, and free sample video viewing are available at no cost.`,
      },
      {
        question: 'Where can I find sale information?',
        answer: 'You can find sales on the homepage sale section or by using the "On Sale Only" filter on the products page. We collect the latest sale information from each streaming site in real-time.',
      },
    ],
    zh: [
      {
        question: `${siteName}是什么？`,
        answer: `${siteName}是一个跨平台搜索服务，涵盖DUGA、MGS、SOKMIL、加勒比海、一本道、HEYZO等主要成人视频平台。我们提供超过38,000名AV女优的信息、价格比较和免费样片链接。`,
      },
      {
        question: '支持哪些视频平台？',
        answer: '支持DUGA、MGS（PRESTIGE、S1、Ideapocket等）、SOKMIL、加勒比海、加勒比海Premium、一本道、HEYZO、天然娘、Pacopacomama、FC2内容市场、Japanska等主要平台。',
      },
      {
        question: '可以免费使用吗？',
        answer: `是的，${siteName}完全免费使用。女优搜索、作品搜索、价格比较、免费样片观看等所有功能都是免费的。`,
      },
      {
        question: '在哪里可以查看特卖信息？',
        answer: '您可以在首页的特卖区域或作品列表页面的"仅显示特卖"筛选器中查看。我们实时收集各平台的最新特卖信息。',
      },
    ],
    ko: [
      {
        question: `${siteName}이란 무엇인가요?`,
        answer: `${siteName}은 DUGA, MGS, SOKMIL, 카리비안컴, 일본도, HEYZO 등 주요 성인 비디오 스트리밍 사이트를 통합 검색할 수 있는 서비스입니다. 38,000명 이상의 AV 여배우 정보, 가격 비교, 무료 샘플 비디오 링크를 제공합니다.`,
      },
      {
        question: '어떤 스트리밍 사이트를 지원하나요?',
        answer: 'DUGA, MGS(PRESTIGE, S1, Ideapocket 등), SOKMIL, 카리비안컴, 카리비안컴 프리미엄, 일본도, HEYZO, 천연무스메, 파코파코마마, FC2 콘텐츠 마켓, Japanska 등 주요 사이트를 지원합니다.',
      },
      {
        question: '무료로 이용할 수 있나요?',
        answer: `네, ${siteName}은 완전 무료입니다. 여배우 검색, 작품 검색, 가격 비교, 무료 샘플 비디오 시청 등 모든 기능을 무료로 이용하실 수 있습니다.`,
      },
      {
        question: '세일 정보는 어디서 확인할 수 있나요?',
        answer: '홈페이지의 세일 섹션 또는 작품 목록 페이지의 "세일 중만" 필터에서 확인할 수 있습니다. 각 스트리밍 사이트의 최신 세일 정보를 실시간으로 수집합니다.',
      },
    ],
  };

  return faqsByLocale[locale] || faqsByLocale.ja;
}

/**
 * 構造化データ: CollectionPage（作品一覧・検索結果ページ）
 * ページネーション情報を含むことでSEO向上
 */
export function generateCollectionPageSchema(
  name: string,
  description: string,
  url: string,
  locale: string = 'ja',
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
  },
) {
  const { siteName } = siteConfig;
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    url: `${siteUrl}${url}`,
    inLanguage: locale,
    isPartOf: {
      '@type': 'WebSite',
      name: siteName,
      url: siteUrl,
    },
  };

  if (pagination) {
    schema.numberOfItems = pagination.totalItems;

    // ページネーション情報
    if (pagination.currentPage > 1) {
      const prevPageUrl = url.includes('?')
        ? `${url}&page=${pagination.currentPage - 1}`
        : `${url}?page=${pagination.currentPage - 1}`;
      schema.relatedLink = `${siteUrl}${prevPageUrl}`;
    }
  }

  return schema;
}

/**
 * 構造化データ: Organization（サイト運営者）
 */
export function generateOrganizationSchema(locale: string = 'ja') {
  const { siteName, alternateName, defaultDescription } = siteConfig;
  const localeDescriptions: Record<string, string> = {
    ja: defaultDescription,
    en: 'Cross-platform adult streaming hub covering DUGA, MGS, DTI with actress-based reviews, rankings, and campaign updates for heavy users.',
    zh: '跨平台成人影音中心，涵盖DUGA、MGS、DTI，提供基于女优的评论、排名和活动更新，专为重度用户打造。',
    ko: '여러 플랫폼을 아우르는 성인 스트리밍 허브로, DUGA, MGS, DTI를 다루며 헤비 유저를 위한 여배우 기반 리뷰, 랭킹 및 캠페인 업데이트를 제공합니다.',
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteName,
    alternateName,
    url: siteUrl,
    description: localeDescriptions[locale] || localeDescriptions.ja,
    logo: {
      '@type': 'ImageObject',
      url: `${siteUrl}/logo.png`,
      width: 512,
      height: 512,
    },
    foundingDate: '2024',
    slogan: 'Discover, Compare, Enjoy',
    knowsAbout: [
      'アダルト動画',
      'AV女優',
      'DUGA',
      'MGS',
      'SOKMIL',
      'DTI',
      'カリビアンコム',
      '一本道',
      'HEYZO',
    ],
    areaServed: {
      '@type': 'Country',
      name: 'Japan',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: ['Japanese', 'English', 'Chinese', 'Korean'],
    },
  };
}

/**
 * カテゴリページ用FAQ（多言語対応）
 * Googleリッチリザルトに表示されCTR向上を狙う
 */
export function getCategoryPageFAQs(locale: string = 'ja'): { question: string; answer: string }[] {
  const faqsByLocale: Record<string, { question: string; answer: string }[]> = {
    ja: [
      {
        question: 'カテゴリ検索でどんなジャンルが探せますか？',
        answer: '人気ジャンル、シチュエーション、プレイ内容、体型、コスチュームなど多彩なカテゴリから作品を探せます。各カテゴリは作品数順に並んでおり、人気のジャンルがすぐに見つかります。',
      },
      {
        question: '複数のジャンルを組み合わせて検索できますか？',
        answer: 'はい、作品一覧ページでは「含む」と「除外」フィルターを使って、複数のジャンルを組み合わせた検索が可能です。お好みの条件で絞り込むことができます。',
      },
      {
        question: 'どのカテゴリが一番人気ですか？',
        answer: 'カテゴリ一覧ページでは各ジャンルの作品数が表示されています。作品数が多いジャンルほど人気があり、豊富なコンテンツから選ぶことができます。',
      },
    ],
    en: [
      {
        question: 'What genres can I search for in the category search?',
        answer: 'You can search for products from various categories including popular genres, situations, play types, body types, and costumes. Categories are sorted by the number of products, making it easy to find popular genres.',
      },
      {
        question: 'Can I combine multiple genres in my search?',
        answer: 'Yes, on the product listing page, you can use "Include" and "Exclude" filters to combine multiple genres. This allows you to narrow down your search to match your preferences.',
      },
      {
        question: 'Which categories are most popular?',
        answer: 'The category listing page shows the number of products for each genre. Genres with more products are more popular and offer a wider selection of content to choose from.',
      },
    ],
    zh: [
      {
        question: '分类搜索可以找到哪些类型？',
        answer: '您可以从人气类型、场景、玩法、体型、服装等多种分类中搜索作品。各分类按作品数量排序，可以快速找到热门类型。',
      },
      {
        question: '可以组合多个类型进行搜索吗？',
        answer: '可以。在作品列表页面，您可以使用"包含"和"排除"筛选器来组合多个类型进行搜索，按您的喜好进行筛选。',
      },
      {
        question: '哪个分类最受欢迎？',
        answer: '分类列表页面显示了每个类型的作品数量。作品数量越多的类型越受欢迎，可以从丰富的内容中选择。',
      },
    ],
    ko: [
      {
        question: '카테고리 검색에서 어떤 장르를 찾을 수 있나요?',
        answer: '인기 장르, 상황, 플레이 유형, 체형, 의상 등 다양한 카테고리에서 작품을 검색할 수 있습니다. 각 카테고리는 작품 수 순으로 정렬되어 인기 장르를 쉽게 찾을 수 있습니다.',
      },
      {
        question: '여러 장르를 조합하여 검색할 수 있나요?',
        answer: '네, 작품 목록 페이지에서 "포함" 및 "제외" 필터를 사용하여 여러 장르를 조합한 검색이 가능합니다. 원하는 조건으로 좁힐 수 있습니다.',
      },
      {
        question: '어떤 카테고리가 가장 인기 있나요?',
        answer: '카테고리 목록 페이지에서 각 장르의 작품 수를 확인할 수 있습니다. 작품 수가 많은 장르일수록 인기가 있으며, 풍부한 콘텐츠에서 선택할 수 있습니다.',
      },
    ],
  };

  return faqsByLocale[locale] || faqsByLocale.ja;
}
