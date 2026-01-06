/**
 * HTML/テキストパース用ユーティリティ
 *
 * 価格抽出、出演者名パース、日付変換などの共通処理
 */

// ============================================================
// Price Extraction
// ============================================================

/**
 * 価格情報
 */
export interface PriceInfo {
  /** 現在価格 */
  price: number;
  /** 元価格（セール時） */
  originalPrice?: number;
  /** 割引率 */
  discountPercent?: number;
  /** セール名 */
  saleName?: string;
  /** セールタイプ */
  saleType?: string;
}

/**
 * テキストから価格を抽出
 *
 * @example
 * extractPrice('¥1,980')  // 1980
 * extractPrice('1980円')  // 1980
 * extractPrice('$19.99')  // 1999 (cents)
 */
export function extractPrice(text: string | null | undefined): number | null {
  if (!text) return null;

  // カンマと通貨記号を削除
  const cleaned = text
    .replace(/[¥￥$円,、]/g, '')
    .replace(/\s/g, '')
    .trim();

  // 数値を抽出
  const match = cleaned.match(/(\d+)/);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }

  return null;
}

/**
 * 価格情報を抽出（通常価格とセール価格の両方）
 *
 * @example
 * extractPriceInfo('¥2,980 → ¥1,980 (33%OFF)')
 * // { price: 1980, originalPrice: 2980, discountPercent: 33 }
 */
export function extractPriceInfo(text: string | null | undefined): PriceInfo | null {
  if (!text) return null;

  const result: PriceInfo = { price: 0 };

  // 割引率を抽出 (33%OFF, 30%引き, etc.)
  const discountMatch = text.match(/(\d+)\s*%\s*(OFF|引き|オフ)/i);
  if (discountMatch && discountMatch[1]) {
    result.discountPercent = parseInt(discountMatch[1], 10);
  }

  // 価格を抽出
  const prices: number[] = [];
  const priceMatches = text.matchAll(/[¥￥]?\s*(\d{1,3}(?:[,，]\d{3})*)\s*円?/g);
  for (const match of priceMatches) {
    const priceStr = match[1];
    if (priceStr) {
      const price = parseInt(priceStr.replace(/[,，]/g, ''), 10);
      if (price > 0) {
        prices.push(price);
      }
    }
  }

  if (prices.length === 0) {
    return null;
  }

  if (prices.length === 1 && prices[0] !== undefined) {
    result['price'] = prices[0];
  } else if (prices.length >= 2 && prices[0] !== undefined && prices[1] !== undefined) {
    // 2つ以上の価格がある場合、大きい方を元価格、小さい方を現在価格とする
    prices.sort((a, b) => b - a);
    result['originalPrice'] = prices[0];
    result['price'] = prices[1];

    // 割引率が未設定の場合、計算
    if (!result.discountPercent && result['originalPrice'] > result['price']) {
      result.discountPercent = Math.round(
        ((result['originalPrice'] - result['price']) / result['originalPrice']) * 100
      );
    }
  }

  return result;
}

// ============================================================
// Performer Name Parsing
// ============================================================

/**
 * 出演者名のパース結果
 */
export interface ParsedPerformer {
  name: string;
  nameKana?: string;
  aliasNames?: string[];
}

/**
 * 出演者名をパース
 *
 * 様々なフォーマットに対応:
 * - "山田太郎"
 * - "山田太郎（やまだたろう）"
 * - "山田太郎(やまだたろう)"
 * - "山田太郎 / Taro Yamada"
 */
export function parsePerformerName(text: string | null | undefined): ParsedPerformer | null {
  if (!text) return null;

  const trimmed = text.trim();
  if (!trimmed) return null;

  const result: ParsedPerformer = { name: trimmed };

  // カッコ内の読み仮名を抽出
  const kanaMatch = trimmed.match(/^(.+?)[（(]([ぁ-んァ-ン]+)[）)]$/);
  if (kanaMatch && kanaMatch[1] && kanaMatch[2]) {
    result['name'] = kanaMatch[1].trim();
    result['nameKana'] = kanaMatch[2].trim();
  }

  // スラッシュで区切られた別名を抽出
  const slashMatch = trimmed.match(/^(.+?)\s*[/／]\s*(.+)$/);
  if (slashMatch && slashMatch[1] && slashMatch[2]) {
    result['name'] = slashMatch[1].trim();
    result.aliasNames = [slashMatch[2].trim()];
  }

  return result;
}

/**
 * 複数の出演者名をパース（区切り文字で分割）
 *
 * @example
 * parsePerformerNames('山田太郎, 田中花子')
 * parsePerformerNames('山田太郎 / 田中花子')
 * parsePerformerNames('山田太郎、田中花子')
 */
export function parsePerformerNames(
  text: string | null | undefined,
  separators: RegExp = /[,、，\n]+/
): ParsedPerformer[] {
  if (!text) return [];

  return text
    .split(separators)
    .map((name) => parsePerformerName(name))
    .filter((p): p is ParsedPerformer => p !== null);
}

/**
 * 出演者名を正規化（全角/半角統一、不要な空白削除など）
 */
export function normalizePerformerName(name: string): string {
  return name
    .trim()
    // 全角スペースを半角に
    .replace(/　/g, ' ')
    // 連続するスペースを1つに
    .replace(/\s+/g, ' ')
    // 名前の前後の括弧内テキストを削除
    .replace(/[（(][^）)]*[）)]$/, '')
    .trim();
}

// ============================================================
// Date Parsing
// ============================================================

/**
 * 日付文字列をパース
 *
 * @example
 * parseDate('2024年1月15日')     // '2024-01-15'
 * parseDate('2024/01/15')         // '2024-01-15'
 * parseDate('2024-01-15')         // '2024-01-15'
 * parseDate('2024.01.15')         // '2024-01-15'
 * parseDate('Jan 15, 2024')       // '2024-01-15'
 */
export function parseDate(text: string | null | undefined): string | null {
  if (!text) return null;

  const trimmed = text.trim();

  // 日本語形式: 2024年1月15日
  const jpMatch = trimmed.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  if (jpMatch && jpMatch[1] && jpMatch[2] && jpMatch[3]) {
    const [, year, month, day] = jpMatch;
    return formatDate(year, month, day);
  }

  // スラッシュ形式: 2024/01/15 or 01/15/2024
  const slashMatch = trimmed.match(/(\d{2,4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (slashMatch && slashMatch[1] && slashMatch[2] && slashMatch[3]) {
    const part1 = slashMatch[1];
    const part2 = slashMatch[2];
    const part3 = slashMatch[3];

    // 年が最初か最後かを判定
    if (parseInt(part1, 10) > 12) {
      // 年-月-日 形式
      return formatDate(part1, part2, part3);
    } else if (parseInt(part3, 10) > 31) {
      // 月/日/年 形式 (US)
      return formatDate(part3, part1, part2);
    } else {
      // 年-月-日 形式（2桁年の場合）
      const year = part1.length === 2 ? `20${part1}` : part1;
      return formatDate(year, part2, part3);
    }
  }

  // ISO形式: 2024-01-15T...
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch && isoMatch[1] && isoMatch[2] && isoMatch[3]) {
    const [, year, month, day] = isoMatch;
    return formatDate(year, month, day);
  }

  // 英語形式: Jan 15, 2024
  const enMatch = trimmed.match(/([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})/);
  if (enMatch && enMatch[1] && enMatch[2] && enMatch[3]) {
    const [, monthStr, day, year] = enMatch;
    const month = parseEnglishMonth(monthStr);
    if (month) {
      return formatDate(year, month.toString(), day);
    }
  }

  return null;
}

/**
 * 日付をフォーマット
 */
function formatDate(year: string, month: string, day: string): string {
  const y = year.length === 2 ? `20${year}` : year;
  const m = month.padStart(2, '0');
  const d = day.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 英語の月名を数値に変換
 */
function parseEnglishMonth(monthStr: string): number | null {
  const months: Record<string, number> = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12,
  };
  return months[monthStr.toLowerCase()] || null;
}

// ============================================================
// Duration Parsing
// ============================================================

/**
 * 再生時間をパース（分単位で返す）
 *
 * @example
 * parseDuration('120分')      // 120
 * parseDuration('2時間')      // 120
 * parseDuration('2:30:00')    // 150
 * parseDuration('1時間30分')  // 90
 */
export function parseDuration(text: string | null | undefined): number | null {
  if (!text) return null;

  const trimmed = text.trim();

  // 分形式: 120分
  const minMatch = trimmed.match(/(\d+)\s*分/);
  if (minMatch && minMatch[1] && !trimmed.includes('時間')) {
    return parseInt(minMatch[1], 10);
  }

  // 時間+分形式: 2時間30分
  const hourMinMatch = trimmed.match(/(\d+)\s*時間\s*(?:(\d+)\s*分)?/);
  if (hourMinMatch && hourMinMatch[1]) {
    const hours = parseInt(hourMinMatch[1], 10);
    const mins = hourMinMatch[2] ? parseInt(hourMinMatch[2], 10) : 0;
    return hours * 60 + mins;
  }

  // HH:MM:SS or MM:SS 形式
  const colonMatch = trimmed.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (colonMatch && colonMatch[1] && colonMatch[2]) {
    if (colonMatch[3]) {
      // HH:MM:SS
      const hours = parseInt(colonMatch[1], 10);
      const mins = parseInt(colonMatch[2], 10);
      return hours * 60 + mins;
    } else {
      // MM:SS
      return parseInt(colonMatch[1], 10);
    }
  }

  // 数字のみ（分とみなす）
  const numMatch = trimmed.match(/^(\d+)$/);
  if (numMatch && numMatch[1]) {
    return parseInt(numMatch[1], 10);
  }

  return null;
}

// ============================================================
// Text Cleaning
// ============================================================

/**
 * HTMLからテキストを抽出
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * テキストを正規化（全角/半角統一など）
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return '';

  return text
    // 全角英数を半角に
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0)
    )
    // 全角スペースを半角に
    .replace(/　/g, ' ')
    // 連続するスペースを1つに
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 商品IDを正規化
 *
 * @example
 * normalizeProductId('ABC123')    // 'abc123'
 * normalizeProductId('ABC-123')   // 'abc-123'
 */
export function normalizeProductId(id: string): string {
  return id.trim().toLowerCase();
}

// ============================================================
// URL Helpers
// ============================================================

/**
 * 相対URLを絶対URLに変換
 */
export function resolveUrl(base: string, relative: string): string {
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

/**
 * URLからクエリパラメータを取得
 */
export function getQueryParam(url: string, param: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get(param);
  } catch {
    return null;
  }
}

/**
 * URLからパスの最後の部分を取得
 */
export function getLastPathSegment(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const segments = urlObj.pathname.split('/').filter(Boolean);
    return segments[segments.length - 1] || null;
  } catch {
    // URL形式でない場合はパスとして処理
    const segments = url.split('/').filter(Boolean);
    return segments[segments.length - 1] || null;
  }
}

// ============================================================
// Validation Helpers
// ============================================================

/**
 * 有効な画像URLかどうかを判定
 */
export function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;

  try {
    const urlObj = new URL(url);
    const ext = urlObj.pathname.toLowerCase();
    return /\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/i.test(ext) || url.includes('/images/');
  } catch {
    return false;
  }
}

/**
 * 有効な動画URLかどうかを判定
 */
export function isValidVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;

  try {
    const ext = url.toLowerCase();
    return /\.(mp4|webm|m3u8|mpd)(\?|$)/i.test(ext) || url.includes('/video/');
  } catch {
    return false;
  }
}

/**
 * タイトルが有効かどうかを判定
 */
export function isValidTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  const trimmed = title.trim();

  // 空文字
  if (!trimmed) return false;

  // 短すぎる
  if (trimmed.length < 2) return false;

  // 数字のみ
  if (/^\d+$/.test(trimmed)) return false;

  // プレースホルダーっぽい
  if (/^(untitled|no title|タイトルなし|無題)$/i.test(trimmed)) return false;

  return true;
}
