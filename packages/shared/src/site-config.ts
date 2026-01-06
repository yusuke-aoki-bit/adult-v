/**
 * マルチサイト設定
 *
 * www.adult-v.com (メインサイト) と www.f.adult-v.com (FANZAサブドメイン) の
 * 両サイトを同一コードベースで運用するための設定
 *
 * ホスト名判定ロジック:
 * - www.f.adult-v.com (f. で始まる) → FANZAモード
 * - その他 → adult-vモード（デフォルト）
 */

export type SiteMode = 'adult-v' | 'fanza';

export interface SiteConfig {
  mode: SiteMode;
  name: string;
  description: string;
  domain: string;
  // ASPフィルター（このサイトで表示する商品のASP）
  aspFilter: string[] | null; // null = フィルターなし（全ASP）
  // テーマカラー
  primaryColor: string;
  accentColor: string;
  // ロゴ・ブランド
  logo: string;
  brandText: string;
  // SEO
  seoTitle: string;
  seoDescription: string;
  // 相互リンク設定
  crossLinkEnabled: boolean;
  crossLinkSite: SiteMode | null;
  crossLinkUrl: string | null;
}

/**
 * サイト設定定義
 */
export const siteConfigs: Record<SiteMode, SiteConfig> = {
  'adult-v': {
    mode: 'adult-v',
    name: 'Adult-V',
    description: '厳選アダルト動画レビューサイト',
    domain: 'adult-v.com',
    aspFilter: null, // 全ASP表示
    primaryColor: '#6366f1', // indigo
    accentColor: '#8b5cf6', // violet
    logo: '/logo.svg',
    brandText: 'Adult-V',
    seoTitle: 'Adult-V - 厳選アダルト動画レビュー',
    seoDescription: 'DUGA、SOKMIL、MGS、FANZAなど主要ASPの作品をまとめてレビュー。女優別・ジャンル別で探せます。',
    crossLinkEnabled: true,
    crossLinkSite: 'fanza',
    crossLinkUrl: 'https://www.f.adult-v.com',
  },
  'fanza': {
    mode: 'fanza',
    name: 'FANZA Reviews',
    description: 'FANZA作品専門レビューサイト',
    domain: 'www.f.adult-v.com',
    aspFilter: ['FANZA'], // FANZAのみ
    primaryColor: '#ec4899', // pink (FANZA風)
    accentColor: '#f43f5e', // rose
    logo: '/fanza-logo.svg',
    brandText: 'FANZA Reviews',
    seoTitle: 'FANZA Reviews - FANZA作品専門レビュー',
    seoDescription: 'FANZA（DMM）の新作・人気作品をレビュー。出演女優別・ジャンル別で探せます。',
    // FANZAアフィリエイト規約遵守: 他ASPサイトへのリンクはNG
    crossLinkEnabled: false,
    crossLinkSite: null,
    crossLinkUrl: null,
  },
};

/**
 * 環境変数またはホスト名からサイトモードを取得
 */
export function getSiteMode(hostname?: string): SiteMode {
  // 環境変数による強制設定（Cloud Run用）
  const envMode = process.env['SITE_MODE'] as SiteMode;
  if (envMode && (envMode === 'adult-v' || envMode === 'fanza')) {
    return envMode;
  }

  // ホスト名から判定
  if (hostname) {
    const host = hostname.toLowerCase();
    // www.f.adult-v.com または fanza を含む場合はFANZAモード
    if (host.startsWith('www.f.') || host.startsWith('f.') || host.includes('fanza')) {
      return 'fanza';
    }
  }

  // デフォルト
  return 'adult-v';
}

/**
 * 現在のサイト設定を取得
 */
export function getSiteConfig(hostname?: string): SiteConfig {
  const mode = getSiteMode(hostname);
  return siteConfigs[mode];
}

/**
 * サイトモードに基づいてASPフィルターを取得
 */
export function getAspFilter(mode: SiteMode): string[] | null {
  return siteConfigs[mode].aspFilter;
}

/**
 * 相互リンク用のURLを生成
 */
export function getCrossLinkUrl(
  currentMode: SiteMode,
  path: string
): string | null {
  const config = siteConfigs[currentMode];
  if (!config.crossLinkEnabled || !config.crossLinkUrl) {
    return null;
  }
  return `${config.crossLinkUrl}${path}`;
}
