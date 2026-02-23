import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

/**
 * AV Wiki / Seesaa Wiki クライアント
 * 女優の別名情報と作品リストを取得
 */

export interface ActressWikiData {
  canonicalName: string; // 正式名
  aliases: string[]; // 別名リスト
  products: string[]; // 作品ID/品番リスト
  profileImageUrl?: string;
  source: 'av-wiki' | 'seesaa-wiki';
}

/**
 * AV-Wiki から女優情報を取得
 * URL例: https://av-wiki.net/av-actress/椎名ななみ/
 */
export async function fetchAVWikiData(actressName: string): Promise<ActressWikiData | null> {
  try {
    // URL encode actress name
    const encodedName = encodeURIComponent(actressName);
    const url = `https://av-wiki.net/av-actress/${encodedName}/`;

    console.log(`  🔍 Fetching AV-Wiki: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      console.log(`  ⚠️  AV-Wiki not found: ${actressName} (${response['status']})`);
      return null;
    }

    const html = await response['text']();
    const $ = cheerio.load(html);

    // 正式名（h1タイトルから）
    const canonicalName = $('h1.entry-title').text().trim() || actressName;

    // 別名情報（「別名」「旧芸名」などのセクションから）
    const aliases: string[] = [];
    $('table.infobox tr').each((_, row) => {
      const $row = $(row);
      const header = $row.find('th').text().trim();
      if (header.includes('別名') || header.includes('旧芸名') || header.includes('他の名前')) {
        const aliasText = $row.find('td').text().trim();
        // カンマ、スラッシュ、改行で分割
        const names = aliasText
          .split(/[,/\n]/)
          .map((n) => n.trim())
          .filter((n) => n.length > 0);
        aliases.push(...names);
      }
    });

    // 作品リスト（品番）を取得
    const products: string[] = [];

    // パターン1: 作品一覧テーブルから
    $('table.filmography tr').each((_, row) => {
      const $row = $(row);
      const productId = $row.find('td:first-child').text().trim();
      if (productId && /^[A-Z0-9-]+$/i.test(productId)) {
        products.push(productId);
      }
    });

    // パターン2: リンクから品番抽出（ABC-123形式）
    $('a[href*="/product/"], a[href*="product_id="]').each((_, link) => {
      const href = $(link).attr('href') || '';
      const match = href.match(/([A-Z]{2,10}-?\d{2,5})/i);
      if (match?.[1]) {
        products.push(match[1]);
      }
    });

    // プロフィール画像
    const profileImageUrl = $('img.avatar, img.profile-image, .infobox img').first().attr('src');

    console.log(`  ✓ AV-Wiki: ${canonicalName}, ${aliases.length} alias(es), ${products.length} product(s)`);

    const result: ActressWikiData = {
      canonicalName,
      aliases: [...new Set(aliases)], // 重複削除
      products: [...new Set(products)], // 重複削除
      source: 'av-wiki',
    };
    if (profileImageUrl) {
      result.profileImageUrl = profileImageUrl;
    }
    return result;
  } catch (error) {
    console.error(`  ❌ Error fetching AV-Wiki for ${actressName}:`, error);
    return null;
  }
}

/**
 * Seesaa Wiki から女優情報を取得
 * URL例: https://seesaawiki.jp/av_neme/d/椎月叶実
 */
export async function fetchSeesaaWikiData(actressName: string): Promise<ActressWikiData | null> {
  try {
    // Seesaa WikiはEUC-JPエンコード
    const encodedName = encodeURIComponent(actressName);
    const url = `https://seesaawiki.jp/av_neme/d/${encodedName}`;

    console.log(`  🔍 Fetching Seesaa Wiki: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      console.log(`  ⚠️  Seesaa Wiki not found: ${actressName} (${response['status']})`);
      return null;
    }

    // EUC-JP → UTF-8
    const buffer = await response.arrayBuffer();
    const html = iconv.decode(Buffer.from(buffer), 'EUC-JP');
    const $ = cheerio.load(html);

    // 正式名（h1タイトルから）
    const canonicalName = $('h1#page_name').text().trim() || actressName;

    // 別名情報
    const aliases: string[] = [];
    $('#main_body')
      .find('p, li')
      .each((_, elem) => {
        const text = $(elem).text();

        // 「別名:」「旧名:」などの形式
        if (text.includes('別名') || text.includes('旧名') || text.includes('他名義')) {
          const match = text.match(/(?:別名|旧名|他名義)[：:]\s*(.+)/);
          if (match?.[1]) {
            const names = match[1]
              .split(/[,、/]/)
              .map((n) => n.trim())
              .filter((n) => n.length > 0);
            aliases.push(...names);
          }
        }
      });

    // 作品リスト（品番）
    const products: string[] = [];

    // リンクから品番抽出
    $('#main_body a').each((_, link) => {
      const text = $(link).text();

      // 品番形式のテキスト
      const match = text.match(/([A-Z]{2,10}-?\d{2,5})/i);
      if (match?.[1]) {
        products.push(match[1]);
      }
    });

    // テーブルからも品番抽出
    $('#main_body table tr').each((_, row) => {
      const $row = $(row);
      const cells = $row.find('td');
      cells.each((_, cell) => {
        const text = $(cell).text().trim();
        const match = text.match(/([A-Z]{2,10}-?\d{2,5})/i);
        if (match?.[1]) {
          products.push(match[1]);
        }
      });
    });

    console.log(`  ✓ Seesaa Wiki: ${canonicalName}, ${aliases.length} alias(es), ${products.length} product(s)`);

    return {
      canonicalName,
      aliases: [...new Set(aliases)],
      products: [...new Set(products)],
      source: 'seesaa-wiki',
    };
  } catch (error) {
    console.error(`  ❌ Error fetching Seesaa Wiki for ${actressName}:`, error);
    return null;
  }
}

/**
 * 両方のWikiから情報を取得してマージ
 */
export async function fetchActressWikiData(actressName: string): Promise<ActressWikiData | null> {
  // 両方のWikiから並列取得
  const [avWikiData, seesaaWikiData] = await Promise.all([
    fetchAVWikiData(actressName),
    fetchSeesaaWikiData(actressName),
  ]);

  // どちらかが成功すればOK
  if (!avWikiData && !seesaaWikiData) {
    return null;
  }

  // データをマージ
  const primary = avWikiData || seesaaWikiData!;
  const secondary = avWikiData ? seesaaWikiData : null;

  const merged: ActressWikiData = {
    canonicalName: primary.canonicalName,
    aliases: [...primary.aliases],
    products: [...primary.products],
    source: primary.source,
  };
  if (primary.profileImageUrl) {
    merged.profileImageUrl = primary.profileImageUrl;
  }

  // セカンダリソースがあればマージ
  if (secondary) {
    // 別名をマージ（重複削除）
    merged.aliases = [...new Set([...merged.aliases, ...secondary.aliases])];

    // 作品をマージ（重複削除）
    merged.products = [...new Set([...merged.products, ...secondary.products])];

    // 画像がなければセカンダリから
    if (!merged.profileImageUrl && secondary.profileImageUrl) {
      merged.profileImageUrl = secondary.profileImageUrl;
    }
  }

  return merged;
}
