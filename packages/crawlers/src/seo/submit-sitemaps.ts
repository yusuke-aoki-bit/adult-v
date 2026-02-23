/**
 * Google Search Console サイトマップ送信スクリプト
 *
 * Search Console API を使用してサイトマップを送信/更新
 * 新しいrobots.txtに記載されたサイトマップURLを定期的に送信
 *
 * 前提条件:
 *   - Search Consoleでサイトの所有権を確認済み
 *   - サービスアカウントにSearch Consoleオーナー権限を付与
 */

import { google } from 'googleapis';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const PROJECT_ID = 'adult-v';

// サイト設定
const SITES = [
  {
    siteUrl: 'https://www.adult-v.com',
    sitemaps: ['https://www.adult-v.com/sitemap.xml'],
  },
  {
    siteUrl: 'https://www.f.adult-v.com',
    sitemaps: ['https://www.f.adult-v.com/sitemap.xml'],
  },
];

interface SitemapResult {
  siteUrl: string;
  sitemapUrl: string;
  success: boolean;
  error?: string;
  lastSubmitted?: string;
  isPending?: boolean;
  warnings?: number;
  errors?: number;
}

async function getSecret(secretName: string): Promise<string> {
  const client = new SecretManagerServiceClient();
  const [version] = await client.accessSecretVersion({
    name: `projects/${PROJECT_ID}/secrets/${secretName}/versions/latest`,
  });
  return version.payload?.data?.toString() || '';
}

async function main() {
  console.log('📤 サイトマップ送信開始...');
  console.log(`対象サイト: ${SITES.length}件`);

  // シークレットから認証情報を取得
  const serviceAccountKey = await getSecret('google-service-account-key');
  const credentials = JSON.parse(serviceAccountKey);
  console.log(`🔑 サービスアカウント: ${credentials.client_email}`);

  // Google Auth設定
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/webmasters'],
  });

  const searchconsole = google.searchconsole({ version: 'v1', auth });
  const results: SitemapResult[] = [];

  for (const site of SITES) {
    console.log(`\n🌐 サイト: ${site.siteUrl}`);

    for (const sitemapUrl of site.sitemaps) {
      console.log(`  📄 サイトマップ: ${sitemapUrl}`);

      try {
        // サイトマップを送信（既に存在する場合は再送信）
        await searchconsole.sitemaps.submit({
          siteUrl: site.siteUrl,
          feedpath: sitemapUrl,
        });

        console.log(`    ✅ 送信成功`);

        // 送信後のステータスを取得
        try {
          const statusResponse = await searchconsole.sitemaps.get({
            siteUrl: site.siteUrl,
            feedpath: sitemapUrl,
          });

          const sitemap = statusResponse.data;
          const lastSubmitted = sitemap.lastSubmitted || undefined;
          results.push({
            siteUrl: site.siteUrl,
            sitemapUrl,
            success: true,
            ...(lastSubmitted && { lastSubmitted }),
            isPending: sitemap.isPending || false,
            warnings: sitemap.warnings ? Number(sitemap.warnings) : 0,
            errors: sitemap.errors ? Number(sitemap.errors) : 0,
          });

          console.log(`    📊 ステータス: ${sitemap.isPending ? '処理中' : '完了'}`);
          if (sitemap.lastSubmitted) {
            console.log(`    📅 最終送信: ${sitemap.lastSubmitted}`);
          }
          if (sitemap.warnings && Number(sitemap.warnings) > 0) {
            console.log(`    ⚠️ 警告: ${sitemap.warnings}件`);
          }
          if (sitemap.errors && Number(sitemap.errors) > 0) {
            console.log(`    ❌ エラー: ${sitemap.errors}件`);
          }
        } catch (statusError) {
          // ステータス取得失敗は無視（送信自体は成功）
          results.push({
            siteUrl: site.siteUrl,
            sitemapUrl,
            success: true,
          });
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`    ❌ 送信失敗: ${errorMessage}`);
        results.push({
          siteUrl: site.siteUrl,
          sitemapUrl,
          success: false,
          error: errorMessage,
        });
      }
    }
  }

  // 結果サマリー
  console.log('\n📈 送信結果サマリー:');
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;
  console.log(`  ✅ 成功: ${successCount}件`);
  console.log(`  ❌ 失敗: ${failCount}件`);

  if (failCount > 0) {
    console.log('\n⚠️ 失敗したサイトマップ:');
    for (const result of results.filter((r) => !r.success)) {
      console.log(`  - ${result.sitemapUrl}: ${result.error}`);
    }
  }

  // 全サイトマップのステータス一覧を取得
  console.log('\n📋 全サイトマップステータス:');
  for (const site of SITES) {
    try {
      const listResponse = await searchconsole.sitemaps.list({
        siteUrl: site.siteUrl,
      });

      const sitemaps = listResponse.data.sitemap || [];
      console.log(`\n  🌐 ${site.siteUrl} (${sitemaps.length}件):`);

      for (const sitemap of sitemaps) {
        const status = sitemap.isPending ? '⏳処理中' : '✅完了';
        const warnings = sitemap.warnings ? `⚠️${sitemap.warnings}` : '';
        const errors = sitemap.errors ? `❌${sitemap.errors}` : '';
        console.log(`    - ${sitemap.path} ${status} ${warnings} ${errors}`);
      }
    } catch (error) {
      console.log(`  ⚠️ ${site.siteUrl}: ステータス取得失敗`);
    }
  }

  console.log('\n✨ サイトマップ送信完了');

  // 失敗があった場合はエラー終了
  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ エラー:', error);
  process.exit(1);
});
