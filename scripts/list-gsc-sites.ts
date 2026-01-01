import { google } from 'googleapis';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

async function main() {
  console.log('🔍 Search Console 登録サイト一覧\n');

  const client = new SecretManagerServiceClient();
  const [version] = await client.accessSecretVersion({
    name: 'projects/adult-v/secrets/google-service-account-key/versions/latest',
  });
  const credentials = JSON.parse(version.payload?.data?.toString() || '{}');

  console.log('サービスアカウント:', credentials.client_email);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });

  const webmasters = google.webmasters({ version: 'v3', auth });

  try {
    const sites = await webmasters.sites.list();
    console.log('\n📋 登録済みサイト:');
    if (sites.data.siteEntry && sites.data.siteEntry.length > 0) {
      for (const site of sites.data.siteEntry) {
        console.log(`  - ${site.siteUrl} (${site.permissionLevel})`);
      }
    } else {
      console.log('  サイトが見つかりません。サービスアカウントがSearch Consoleに追加されていない可能性があります。');
    }
  } catch (e: any) {
    console.log('エラー:', e.message);
  }
}

main();
