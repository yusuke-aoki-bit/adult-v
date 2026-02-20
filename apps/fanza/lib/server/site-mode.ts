import { getSiteConfig, type SiteMode, type SiteConfig } from '@/lib/site-config';
import { ADULT_V_ASPS } from '@adult-v/shared/asp-registry';

/**
 * サーバーコンポーネントからサイトモードを取得
 * headers()を一切呼ばないことでISR/SSGを維持する
 */
export async function getServerSiteMode(): Promise<SiteMode> {
  // 環境変数を最優先でチェック（Cloud Run / ローカル開発用）
  const envMode = process.env['SITE_MODE'] as SiteMode;
  if (envMode === 'fanza' || envMode === 'adult-v') {
    return envMode;
  }

  // NEXT_PUBLIC_SITE_URLからも判定可能
  const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'] || '';
  if (siteUrl.includes('f.adult-v.com')) return 'fanza';
  if (siteUrl.includes('adult-v.com')) return 'adult-v';

  // デフォルト: fanza（FANZAアプリ用、headers()を呼ばずISR/SSGを維持）
  return 'fanza';
}

/**
 * サーバーコンポーネントからサイト設定を取得
 */
export async function getServerSiteConfig(): Promise<SiteConfig> {
  const mode = await getServerSiteMode();
  return getSiteConfig(mode);
}

/**
 * サーバーコンポーネントからASPフィルターを取得
 * FANZAサイトの場合は['FANZA']を返す
 * Adult Viewerの場合はFANZA以外のASPを返す
 */
export async function getServerAspFilter(): Promise<string[] | null> {
  const mode = await getServerSiteMode();
  if (mode === 'fanza') {
    return ['FANZA'];
  }
  return ADULT_V_ASPS;
}

/**
 * サーバーコンポーネントでFANZAサイトかどうかを判定
 */
export async function isServerFanzaSite(): Promise<boolean> {
  const mode = await getServerSiteMode();
  return mode === 'fanza';
}
