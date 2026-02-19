import { headers } from 'next/headers';
import { getSiteMode, getSiteConfig, type SiteMode, type SiteConfig } from '@/lib/site-config';
import { ADULT_V_ASPS } from '@adult-v/shared/asp-registry';

/**
 * サーバーコンポーネントからサイトモードを取得
 * proxy.tsで設定されたx-site-modeヘッダーを読み取る
 */
export async function getServerSiteMode(): Promise<SiteMode> {
  // 環境変数を最優先でチェック（Cloud Run / ローカル開発用）
  // headers()を呼ばないことでISR/SSGが有効になる
  const envMode = process.env['SITE_MODE'] as SiteMode;
  if (envMode === 'fanza' || envMode === 'adult-v') {
    return envMode;
  }

  // NEXT_PUBLIC_SITE_URLからも判定可能（headers()を回避）
  const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'] || '';
  if (siteUrl.includes('f.adult-v.com')) return 'fanza';
  if (siteUrl.includes('adult-v.com')) return 'adult-v';

  // フォールバック: ヘッダーから判定（dynamic renderingになる）
  const headersList = await headers();
  const siteModeHeader = headersList.get('x-site-mode');

  if (siteModeHeader === 'fanza' || siteModeHeader === 'adult-v') {
    return siteModeHeader;
  }

  const host = headersList.get('host');
  return getSiteMode(host || undefined);
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
  // 環境変数から判定可能な場合はheaders()を呼ばない（ISR/SSG維持）
  const mode = await getServerSiteMode();
  if (mode === 'fanza') {
    return ['FANZA'];
  }
  if (mode === 'adult-v') {
    return ADULT_V_ASPS;
  }

  // フォールバック: ヘッダーから判定
  const headersList = await headers();
  const aspFilter = headersList.get('x-asp-filter');

  if (aspFilter) {
    return aspFilter.split(',').map(s => s.trim());
  }

  return null;
}

/**
 * サーバーコンポーネントでFANZAサイトかどうかを判定
 */
export async function isServerFanzaSite(): Promise<boolean> {
  const mode = await getServerSiteMode();
  return mode === 'fanza';
}
