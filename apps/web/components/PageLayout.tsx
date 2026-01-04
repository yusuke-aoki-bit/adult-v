'use client';

import { ReactNode } from 'react';
import { TopPageUpperSections, TopPageLowerSections } from './TopPageSections';
import { PageSectionNav, type PageSectionNavConfig } from '@adult-v/shared/components';

interface SaleProduct {
  productId: number;
  normalizedProductId: string | null;
  title: string;
  thumbnailUrl: string | null;
  aspName: string;
  affiliateUrl: string | null;
  regularPrice: number;
  salePrice: number;
  discountPercent: number;
  saleName: string | null;
  saleType: string | null;
  endAt: string | null;
  performers: Array<{ id: number; name: string }>;
}

interface PageLayoutProps {
  /** 言語 */
  locale: string;
  /** メインコンテンツ */
  children: ReactNode;
  /** セール商品（上部セクション用） */
  saleProducts?: SaleProduct[];
  /** 未整理商品数（下部セクション用） */
  uncategorizedCount?: number;
  /** TOPページかどうか（トレンド表示制御用） */
  isTopPage?: boolean;
  /** FANZAサイトかどうか */
  isFanzaSite?: boolean;
  /** 翻訳（下部セクション用） */
  translations?: {
    viewProductList: string;
    viewProductListDesc: string;
    uncategorizedBadge: string;
    uncategorizedDescription: string;
    uncategorizedCount: string;
  };
  /** 上部セクションを表示するか */
  showUpperSections?: boolean;
  /** 下部セクションを表示するか */
  showLowerSections?: boolean;
  /** セクションナビゲーションの設定（指定しない場合はナビなし） */
  sectionNavConfig?: Omit<PageSectionNavConfig, 'hasSale' | 'hasRecentlyViewed' | 'hasRecommendations' | 'hasWeeklyHighlights' | 'hasTrending' | 'hasAllProducts'> & {
    mainSectionId: string;
    mainSectionLabel: string;
  };
}

/**
 * 共通ページレイアウト
 *
 * 構成:
 * - 上部: セール中 + 最近見た作品（アコーディオン）
 * - メイン: children
 * - 下部: おすすめ + 今週の注目 + トレンド分析（アコーディオン）+ 商品一覧 + 未整理作品（リンク）
 */
export default function PageLayout({
  locale,
  children,
  saleProducts = [],
  uncategorizedCount = 0,
  isTopPage = false,
  isFanzaSite = false,
  translations,
  showUpperSections = true,
  showLowerSections = true,
  sectionNavConfig,
}: PageLayoutProps) {
  const defaultTranslations = translations || {
    viewProductList: '作品一覧',
    viewProductListDesc: '全ての配信サイトの作品を横断検索',
    uncategorizedBadge: '未整理',
    uncategorizedDescription: '未整理作品',
    uncategorizedCount: `${uncategorizedCount}件`,
  };

  return (
    <div className="theme-body min-h-screen">
      {/* セクションナビゲーション */}
      {sectionNavConfig && (
        <PageSectionNav
          locale={locale}
          config={{
            hasSale: showUpperSections && saleProducts.length > 0,
            hasRecentlyViewed: showUpperSections,
            mainSectionId: sectionNavConfig.mainSectionId,
            mainSectionLabel: sectionNavConfig.mainSectionLabel,
            hasRecommendations: showLowerSections,
            hasWeeklyHighlights: showLowerSections,
            hasTrending: showLowerSections,
            hasAllProducts: showLowerSections,
          }}
          theme="dark"
        />
      )}

      {/* 上部セクション（セール中・最近見た作品） */}
      {showUpperSections && (
        <section id="sale" className="py-3 sm:py-4 scroll-mt-20">
          <div className="container mx-auto px-3 sm:px-4">
            <TopPageUpperSections
              locale={locale}
              saleProducts={saleProducts}
            />
          </div>
        </section>
      )}

      {/* メインコンテンツ */}
      {children}

      {/* 下部セクション（おすすめ・注目・トレンド・リンク） */}
      {showLowerSections && (
        <section id="recommendations" className="py-3 sm:py-4 scroll-mt-20">
          <div className="container mx-auto px-3 sm:px-4">
            <TopPageLowerSections
              locale={locale}
              uncategorizedCount={uncategorizedCount}
              isTopPage={isTopPage}
              isFanzaSite={isFanzaSite}
              translations={defaultTranslations}
            />
          </div>
        </section>
      )}
    </div>
  );
}
