/**
 * DUGA 商品ページスクレイパー
 *
 * DUGA APIでは取得できないレビュー・評価情報を商品ページからスクレイピング
 *
 * 取得データ:
 * - aggregateRating: 平均評価、レビュー数
 * - reviews: 個別レビュー（評価、タイトル、日付、投稿者、本文、参考票数）
 */

export interface DugaReview {
  /** レビューID (投票用) */
  reviewId: string;
  /** 評価 (1.0-5.0) */
  rating: number;
  /** レビュータイトル */
  title: string;
  /** レビュー本文 */
  content: string;
  /** レビュー日 (YYYY-MM-DD) */
  date: string;
  /** 投稿者名 */
  reviewerName: string;
  /** 投稿者ID */
  reviewerId?: string;
  /** 参考になった票数 */
  helpfulYes: number;
  /** 参考にならなかった票数 */
  helpfulNo: number;
}

export interface DugaAggregateRating {
  /** 平均評価 (1.0-5.0) */
  averageRating: number;
  /** レビュー総数 */
  reviewCount: number;
  /** 最低評価 */
  worstRating: number;
  /** 最高評価 */
  bestRating: number;
}

export interface DugaPageData {
  /** 商品ID */
  productId: string;
  /** 集計評価情報 */
  aggregateRating?: DugaAggregateRating;
  /** レビュー一覧 */
  reviews: DugaReview[];
  /** マイリスト登録数 */
  mylistCount?: number;
}

/**
 * DUGA商品ページからレビュー情報をスクレイピング
 *
 * @param productId 商品ID (例: "spc-0350")
 * @returns ページデータ
 */
export async function scrapeDugaProductPage(productId: string): Promise<DugaPageData> {
  const url = `https://duga.jp/ppv/${productId}/`;

  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'ja,en;q=0.9',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch DUGA page: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  return parseDugaPageHtml(productId, html);
}

/**
 * DUGA商品ページHTMLをパース
 */
export function parseDugaPageHtml(productId: string, html: string): DugaPageData {
  const result: DugaPageData = {
    productId,
    reviews: [],
  };

  // マイリスト登録数を抽出
  // <div class="mylistcount"><div class="count-box"><div class="title">マイリスト登録数</div><div class="count">98人</div></div></div>
  const mylistMatch = html.match(/<div class="count">(\d+)人<\/div>/);
  if (mylistMatch) {
    result.mylistCount = parseInt(mylistMatch[1], 10);
  }

  // 集計評価を抽出 (Schema.org AggregateRating)
  // <div itemprop="aggregateRating" itemscope itemtype="http://schema.org/AggregateRating">
  //   <meta itemprop="reviewCount" content="3" />
  //   <meta itemprop="ratingValue" content="5.0" />
  //   <meta itemprop="worstRating" content="1" />
  //   <meta itemprop="bestRating" content="5.0" />
  // </div>
  const aggregateRatingBlock = html.match(
    /<div itemprop="aggregateRating"[^>]*itemtype="http:\/\/schema\.org\/AggregateRating">([\s\S]*?)<\/div>/,
  );
  if (aggregateRatingBlock) {
    const block = aggregateRatingBlock[1];
    const reviewCountMatch = block.match(/<meta itemprop="reviewCount" content="(\d+)"/);
    const ratingValueMatch = block.match(/<meta itemprop="ratingValue" content="([\d.]+)"/);
    const worstRatingMatch = block.match(/<meta itemprop="worstRating" content="(\d+)"/);
    const bestRatingMatch = block.match(/<meta itemprop="bestRating" content="([\d.]+)"/);

    if (reviewCountMatch && ratingValueMatch) {
      result.aggregateRating = {
        reviewCount: parseInt(reviewCountMatch[1], 10),
        averageRating: parseFloat(ratingValueMatch[1]),
        worstRating: worstRatingMatch ? parseInt(worstRatingMatch[1], 10) : 1,
        bestRating: bestRatingMatch ? parseFloat(bestRatingMatch[1]) : 5,
      };
    }
  }

  // 個別レビューを抽出
  // <div class="eachreview" itemprop="review" itemscope itemtype="http://schema.org/Review">
  const reviewRegex = /<div class="eachreview"[^>]*itemprop="review"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
  const reviewMatches = Array.from(html.matchAll(reviewRegex));

  for (const match of reviewMatches) {
    const reviewHtml = match[1];

    // 評価を抽出
    // <meta itemprop="ratingValue" content="5.0" />
    const ratingMatch = reviewHtml.match(/<meta itemprop="ratingValue" content="([\d.]+)"/);
    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;

    // タイトルを抽出
    // <div class="title" itemprop="name">今年も素晴らしいです</div>
    const titleMatch = reviewHtml.match(/<div class="title"[^>]*itemprop="name"[^>]*>([^<]+)<\/div>/);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // 日付を抽出
    // <span itemprop="datePublished" content="2025-11-24">
    const dateMatch = reviewHtml.match(/<span[^>]*itemprop="datePublished"[^>]*content="([^"]+)"/);
    const date = dateMatch ? dateMatch[1] : '';

    // 投稿者を抽出
    // <a href="/user/M20191021001340/"><span itemprop="name">そらぴ</span></a>
    const reviewerIdMatch = reviewHtml.match(/<a href="\/user\/([^\/]+)\/"/);
    const reviewerNameMatch = reviewHtml.match(/<span itemprop="name">([^<]+)<\/span><\/a><\/div>/);
    const reviewerId = reviewerIdMatch ? reviewerIdMatch[1] : undefined;
    const reviewerName = reviewerNameMatch ? reviewerNameMatch[1].trim() : '';

    // 本文を抽出
    // <p class="comment" itemprop="reviewBody">...</p>
    const contentMatch = reviewHtml.match(/<p class="comment"[^>]*itemprop="reviewBody"[^>]*>([\s\S]*?)<\/p>/);
    const content = contentMatch ? contentMatch[1].trim() : '';

    // レビューIDを抽出
    // reviewid="137408"
    const reviewIdMatch = reviewHtml.match(/reviewid="(\d+)"/);
    const reviewId = reviewIdMatch ? reviewIdMatch[1] : '';

    // 参考票数を抽出
    // <span id="votecount-yes-137408">5</span>
    // <span id="votecount-no-137408">2</span>
    const helpfulYesMatch = reviewHtml.match(/<span id="votecount-yes-\d+">(\d+)<\/span>/);
    const helpfulNoMatch = reviewHtml.match(/<span id="votecount-no-\d+">(\d+)<\/span>/);
    const helpfulYes = helpfulYesMatch ? parseInt(helpfulYesMatch[1], 10) : 0;
    const helpfulNo = helpfulNoMatch ? parseInt(helpfulNoMatch[1], 10) : 0;

    if (reviewId || title || content) {
      result.reviews.push({
        reviewId,
        rating,
        title,
        content,
        date,
        reviewerName,
        reviewerId,
        helpfulYes,
        helpfulNo,
      });
    }
  }

  return result;
}

/**
 * 複数の商品IDに対してレビューを取得
 *
 * @param productIds 商品IDリスト
 * @param delayMs リクエスト間隔 (ミリ秒)
 * @returns 商品IDをキーとしたレビューデータのマップ
 */
export async function scrapeDugaReviewsBatch(
  productIds: string[],
  delayMs: number = 1000,
): Promise<Map<string, DugaPageData>> {
  const results = new Map<string, DugaPageData>();

  for (const productId of productIds) {
    try {
      const data = await scrapeDugaProductPage(productId);
      results.set(productId, data);

      // レート制限対策
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      console.error(`Failed to scrape ${productId}:`, error);
      // エラーでも続行
    }
  }

  return results;
}
