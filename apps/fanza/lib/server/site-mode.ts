import { headers } from 'next/headers';
import { getSiteMode, getSiteConfig, type SiteMode, type SiteConfig } from '@/lib/site-config';

/**
 * サーバーコンポーネントからサイトモードを取得
 * proxy.tsで設定されたx-site-modeヘッダーを読み取る
 */
export async function getServerSiteMode(): Promise<SiteMode> {
  // 環境変数を最優先でチェック（Cloud Run / ローカル開発用）
  const envMode = process.env.SITE_MODE as SiteMode;
  if (envMode === 'fanza' || envMode === 'adult-v') {
    return envMode;
  }

  const headersList = await headers();
  const siteModeHeader = headersList.get('x-site-mode');

  if (siteModeHeader === 'fanza' || siteModeHeader === 'adult-v') {
    return siteModeHeader;
  }

  // フォールバック: ホスト名から判定
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
 */
export async function getServerAspFilter(): Promise<string[] | null> {
  const headersList = await headers();
  const aspFilter = headersList.get('x-asp-filter');

  if (aspFilter) {
    return aspFilter.split(',').map(s => s.trim());
  }

  // フォールバック: サイトモードから判定
  const mode = await getServerSiteMode();
  if (mode === 'fanza') {
    return ['FANZA'];
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
