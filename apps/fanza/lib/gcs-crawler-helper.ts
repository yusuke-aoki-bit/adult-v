/**
 * クローラー用GCSヘルパー関数
 * Re-exports from shared package
 */
export {
  isGcsEnabled,
  calculateHash,
  saveRawHtml,
  saveRawJson,
  getRawContent,
  logGcsStats,
  crawlerGcsHelper,
} from '@adult-v/shared/lib/gcs-crawler-helper';

export { crawlerGcsHelper as default } from '@adult-v/shared/lib/gcs-crawler-helper';
