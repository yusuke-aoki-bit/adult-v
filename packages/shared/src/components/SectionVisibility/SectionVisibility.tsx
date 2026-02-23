'use client';

import { ReactNode } from 'react';
import { useHomeSections } from '../../hooks/useHomeSections';

export interface SectionVisibilityProps {
  /** セクションID */
  sectionId: string;
  /** ページID */
  pageId: string;
  /** ロケール */
  locale: string;
  /** 子要素 */
  children: ReactNode;
  /** フォールバック表示（非表示時） */
  fallback?: ReactNode;
}

/**
 * セクション表示制御コンポーネント
 * useHomeSectionsの設定に基づいてセクションの表示/非表示を制御
 * Server Componentから使用可能なClient Componentラッパー
 */
export function SectionVisibility({ sectionId, pageId, locale, children, fallback = null }: SectionVisibilityProps) {
  const { isSectionVisible, isLoaded } = useHomeSections({ locale, pageId });

  // ロード中は表示（SSR時のハイドレーション対策）
  if (!isLoaded) {
    return <>{children}</>;
  }

  if (!isSectionVisible(sectionId)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export default SectionVisibility;
