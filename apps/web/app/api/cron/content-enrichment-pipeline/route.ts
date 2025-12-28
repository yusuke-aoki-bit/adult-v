/**
 * コンテンツエンリッチメント統合パイプライン Cron API
 *
 * Cloud Schedulerから定期的に呼び出される
 * 翻訳 + SEO強化 + 演者紐付けを一括で実行
 *
 * GET /api/cron/content-enrichment-pipeline?limit=100&phases=translation,seo,performer
 */

import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth';
import { getDb } from '@/lib/db';
import { requestIndexing, checkGoogleApiConfig } from '@/lib/google-apis';
import { createContentEnrichmentPipelineHandler } from '@adult-v/shared/cron-handlers';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// DeepL翻訳関数
async function translateText(text: string, targetLang: string): Promise<string | null> {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) return null;

  try {
    const baseUrl = apiKey.endsWith(':fx')
      ? 'https://api-free.deepl.com/v2/translate'
      : 'https://api.deepl.com/v2/translate';

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: [text],
        target_lang: targetLang,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.translations?.[0]?.text || null;
  } catch {
    return null;
  }
}

export const GET = createContentEnrichmentPipelineHandler({
  verifyCronRequest,
  unauthorizedResponse,
  getDb,
  translateText,
  requestIndexing: checkGoogleApiConfig().indexing ? requestIndexing : undefined,
  siteBaseUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://adult-v.com',
});
