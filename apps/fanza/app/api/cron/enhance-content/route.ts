/**
 * コンテンツ強化 Cron API エンドポイント
 *
 * Google APIs を使用して商品情報を強化:
 * - Vision API: 画像分析（顔検出、ラベル付け）
 * - Translation API: 多言語翻訳（英語、中国語、韓国語）
 * - YouTube API: 関連動画検索
 *
 * GET /api/cron/enhance-content?type=vision|translate|youtube&limit=50
 */

import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth';
import { getDb } from '@/lib/db';
import {
  detectFaces,
  labelImage,
  translateText,
  searchYouTubeVideos,
  checkGoogleApiConfig,
} from '@/lib/google-apis';
import { createEnhanceContentHandler } from '@adult-v/shared/cron-handlers';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const GET = createEnhanceContentHandler({
  verifyCronRequest,
  unauthorizedResponse,
  getDb,
  detectFaces,
  labelImage,
  translateText,
  searchYouTubeVideos,
  checkGoogleApiConfig,
});
