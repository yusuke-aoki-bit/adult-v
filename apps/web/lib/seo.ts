// Re-export from @adult-v/shared with site-specific config
import { setSeoConfig } from '@adult-v/shared/lib/seo';

// Adult Viewer Lab用の設定
setSeoConfig({
  siteName: 'Adult Viewer Lab',
  alternateName: 'アダルトビューアーラボ',
  defaultDescription:
    '複数のプラットフォームを横断し、ヘビー視聴者向けに女優・ジャンル別のレビュー、ランキング、キャンペーン速報を届けるアフィリエイトサイト。',
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
