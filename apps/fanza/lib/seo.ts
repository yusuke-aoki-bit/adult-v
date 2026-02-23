// Re-export from @adult-v/shared with site-specific config
import { setSeoConfig } from '@adult-v/shared/lib/seo';

// AVVIEWER LAB (FANZA)用の設定
setSeoConfig({
  siteName: 'AVVIEWER LAB',
  alternateName: 'AVビューアーラボ',
  defaultDescription:
    'FANZA作品の検索・比較サービス。女優情報、ランキング、セール情報をヘビー視聴者向けに整理しています。',
});

export {
  setSeoConfig,
  getSeoConfig,
  generateOptimizedDescription,
  generateBaseMetadata,
  generateWebSiteSchema,
  generateBreadcrumbSchema,
  generatePersonSchema,
  generateProductSchema,
  generateVideoObjectSchema,
  generateItemListSchema,
  generateFAQSchema,
  getHomepageFAQs,
  generateCollectionPageSchema,
  generateOrganizationSchema,
  getCategoryPageFAQs,
  getProductPageFAQs,
  getActressPageFAQs,
  generateReviewSchema,
  generateCriticReviewSchema,
  // 新規追加: SEO強化用スキーマ
  generateHowToSchema,
  generateAggregateOfferSchema,
  generateProductItemListSchema,
  generatePerformerItemListSchema,
} from '@adult-v/shared/lib/seo';
