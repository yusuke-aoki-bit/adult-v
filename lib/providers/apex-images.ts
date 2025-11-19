/**
 * APEX商品IDから画像URLを生成するユーティリティ
 * 
 * 商品URLパターン: http://duga.jp/ppv/{series}-{number}/
 * 画像URLパターン: https://pic.duga.jp/unsecure/{series}/{number}/noauth/240x180.jpg
 */

/**
 * 商品IDから画像URLを生成
 * @param productId 商品ID (例: "100hame-0002")
 * @returns 画像URL
 */
export function generateApexImageUrl(productId: string): string {
  // 商品IDを分割 (例: "100hame-0002" -> ["100hame", "0002"])
  const parts = productId.split('-');
  
  if (parts.length < 2) {
    // フォーマットが異なる場合はデフォルト画像を返す
    return 'https://placehold.co/600x800/052e16/ffffff?text=APEX';
  }
  
  const series = parts[0]; // "100hame"
  const number = parts.slice(1).join('-'); // "0002" (複数のハイフンがある場合も対応)
  
  // 画像URLを生成
  // サムネイル画像: 240x180.jpg
  return `https://pic.duga.jp/unsecure/${series}/${number}/noauth/240x180.jpg`;
}

/**
 * 複数の画像サイズを取得
 */
export function getApexImageUrls(productId: string) {
  const parts = productId.split('-');
  
  if (parts.length < 2) {
    return {
      thumbnail: 'https://placehold.co/600x800/052e16/ffffff?text=APEX',
      sample: 'https://placehold.co/600x800/052e16/ffffff?text=APEX',
    };
  }
  
  const series = parts[0];
  const number = parts.slice(1).join('-');
  const basePath = `https://pic.duga.jp/unsecure/${series}/${number}/noauth`;
  
  return {
    // サムネイル (240x180)
    thumbnail: `${basePath}/240x180.jpg`,
    // サンプル画像 (最初の1枚)
    sample: `${basePath}/scap/001.jpg`,
    // より大きなサイズも試す
    medium: `${basePath}/480x360.jpg`,
    large: `${basePath}/640x480.jpg`,
  };
}

/**
 * 画像URLが有効か確認（実際にはアクセスして確認）
 * 注意: 大量のリクエストは避けること
 */
export async function validateImageUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    return response.ok;
  } catch {
    return false;
  }
}



