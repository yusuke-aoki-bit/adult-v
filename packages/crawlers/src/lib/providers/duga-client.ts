/**
 * DUGA (APEX) Web Service API Client
 *
 * 公式ドキュメント: https://duga.jp/aff/member/webservice/
 * API利用規約: https://duga.jp/aff/member/html/api-rule.html
 * クレジット表示義務: https://duga.jp/aff/member/html/api-credit.html
 *
 * レート制限: 60リクエスト/60秒 (1アプリケーションIDごと)
 * APIバージョン: 1.2
 */

import { robustFetch, crawlerLog } from '../crawler';

/**
 * DUGA API検索パラメータ
 */
export interface DugaSearchParams {
  /** APIバージョン (1.0～1.2) */
  version?: '1.0' | '1.1' | '1.2';
  /** アプリケーションID (必須) */
  appid: string;
  /** 代理店ID (必須) */
  agentid: string;
  /** バナーID (必須: 01～99) */
  bannerid: string;
  /** レスポンス形式 (xml | json) */
  format?: 'xml' | 'json';
  /** 検索語句 (UTF-8) */
  keyword?: string;
  /** 取得件数 (1～100) */
  hits?: number;
  /** 取得開始位置 */
  offset?: number;
  /** レーティング (1:アダルト, 0:一般) */
  adult?: 0 | 1;
  /** 並び順 */
  sort?: 'favorite' | 'release' | 'new' | 'price' | 'rating' | 'mylist';
  /** 販売種別 */
  target?: 'ppv' | 'sd' | 'rental' | 'hd' | 'hdrental';
  /** カテゴリID */
  category?: string;
  /** デバイス (smart: スマホ・タブレット対応) */
  device?: 'smart';
  /** レーベルID */
  labelid?: string;
  /** シリーズID */
  seriesid?: string;
  /** 出演者ID */
  performerid?: string;
  /** 公開日 始点 (YYYYMMDD) */
  openstt?: string;
  /** 公開日 終点 (YYYYMMDD) */
  openend?: string;
  /** 発売日 始点 (YYYYMMDD) */
  releasestt?: string;
  /** 発売日 終点 (YYYYMMDD) */
  releaseend?: string;
}

/**
 * DUGA API レスポンス
 */
export interface DugaApiResponse {
  /** 表示件数 */
  hits: number;
  /** 検索ヒット件数 */
  count: number;
  /** 表示開始位置 */
  offset: number;
  /** 作品リスト */
  items: DugaProduct[];
}

/**
 * DUGA作品情報
 */
export interface DugaProduct {
  /** 作品ID */
  productId: string;
  /** タイトル */
  title: string;
  /** タイトル (カナ) */
  titleKana?: string;
  /** 説明文 */
  description?: string;
  /** サムネイル画像URL */
  thumbnailUrl?: string;
  /** パッケージ画像URL */
  packageUrl?: string;
  /** サンプル画像URLリスト */
  sampleImages?: string[];
  /** サンプル動画URLリスト */
  sampleVideos?: string[];
  /** アフィリエイトURL */
  affiliateUrl: string;
  /** 価格 */
  price?: number;
  /** 発売日 (YYYY-MM-DD) */
  releaseDate?: string;
  /** 公開日 (YYYY-MM-DD) */
  openDate?: string;
  /** 収録時間 (分) */
  duration?: number;
  /** レーベル名 */
  label?: string;
  /** レーベルID */
  labelId?: string;
  /** シリーズ名 */
  series?: string;
  /** シリーズID */
  seriesId?: string;
  /** 出演者リスト */
  performers?: Array<{
    id: string;
    name: string;
  }>;
  /** カテゴリリスト */
  categories?: Array<{
    id: string;
    name: string;
  }>;
  /** 販売種別 */
  salesType?: string;
  /** レーティング (0:一般, 1:アダルト) */
  adult?: 0 | 1;
  /** マルチデバイス対応 */
  multiDevice?: boolean;
  /** セール情報 */
  saleInfo?: {
    regularPrice: number;
    salePrice: number;
    discountPercent?: number;
    saleType?: string;
    saleName?: string;
  };
}

/**
 * レート制限エラー
 */
export class RateLimitError extends Error {
  constructor(message: string = 'API rate limit exceeded (60 requests per 60 seconds)') {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * DUGA API Client
 *
 * レート制限を管理し、DUGA Web Service APIへの安全なアクセスを提供
 */
export class DugaApiClient {
  private readonly baseUrl: string;
  private readonly appId: string;
  private readonly agentId: string;
  private readonly bannerId: string;
  private readonly requestTimestamps: number[] = [];
  private readonly maxRequestsPer60Seconds = 60;

  constructor(config: { appId: string; agentId: string; bannerId?: string; baseUrl?: string }) {
    this.appId = config.appId;
    this.agentId = config.agentId;
    this.bannerId = config.bannerId || '01';
    // 正しいDUGA API エンドポイント
    this.baseUrl = config.baseUrl || 'http://affapi.duga.jp/search';
  }

  /**
   * レート制限をチェック
   * 60秒間に60リクエストを超えていないか確認
   */
  private checkRateLimit(): void {
    const now = Date.now();
    const sixtySecondsAgo = now - 60000;

    // 60秒以上前のタイムスタンプを削除
    while (this.requestTimestamps.length > 0 && (this.requestTimestamps[0] ?? 0) < sixtySecondsAgo) {
      this.requestTimestamps.shift();
    }

    // レート制限チェック
    if (this.requestTimestamps.length >= this.maxRequestsPer60Seconds) {
      throw new RateLimitError();
    }

    // 新しいタイムスタンプを追加
    this.requestTimestamps.push(now);
  }

  /**
   * 作品を検索
   *
   * @param params 検索パラメータ
   * @returns API レスポンス
   * @throws RateLimitError レート制限エラー
   */
  async searchProducts(params: Partial<DugaSearchParams> = {}): Promise<DugaApiResponse> {
    this.checkRateLimit();

    const searchParams = new URLSearchParams({
      version: params.version || '1.2',
      appid: this.appId,
      agentid: this.agentId,
      bannerid: this.bannerId,
      format: params['format'] || 'json',
      // timestampは不要（APIでinvalid timestampエラーになる）
      ...(params.keyword && { keyword: params.keyword }),
      ...(params.hits && { hits: params.hits.toString() }),
      ...(params.offset && { offset: params.offset.toString() }),
      ...(params.adult !== undefined && { adult: params.adult.toString() }),
      ...(params.sort && { sort: params.sort }),
      ...(params.target && { target: params.target }),
      ...(params.category && { category: params.category }),
      ...(params.device && { device: params.device }),
      ...(params.labelid && { labelid: params.labelid }),
      ...(params.seriesid && { seriesid: params.seriesid }),
      ...(params.performerid && { performerid: params.performerid }),
      ...(params.openstt && { openstt: params.openstt }),
      ...(params.openend && { openend: params.openend }),
      ...(params.releasestt && { releasestt: params.releasestt }),
      ...(params.releaseend && { releaseend: params.releaseend }),
    });

    const url = `${this.baseUrl}?${searchParams.toString()}`;

    try {
      const response = await robustFetch(url, {
        init: {
          method: 'GET',
          headers: {
            'User-Agent': 'DUGA-API-Client/1.0',
          },
        },
        timeoutMs: 30000,
        retry: {
          maxRetries: 3,
          initialDelayMs: 1000,
          onRetry: (error, attempt, delayMs) => {
            crawlerLog.warn(`DUGA API retry ${attempt} after ${delayMs}ms: ${error.message}`);
          },
        },
      });

      if (!response.ok) {
        throw new Error(`DUGA API error: ${response['status']} ${response.statusText}`);
      }

      const data = await response.json();
      return this.normalizeResponse(data);
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw error;
      }
      throw new Error(`Failed to fetch from DUGA API: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * APIレスポンスを正規化
   *
   * @param data 生のAPIレスポンス
   * @returns 正規化されたレスポンス
   */
  private normalizeResponse(data: any): DugaApiResponse {
    // APIのレスポンス構造: { hits: "2", count: 185871, items: [{item: {...}}, ...] }
    // hitsはstring型で返ってくるため、parseIntで数値に変換
    const items = data.items || data.products || [];
    return {
      hits: typeof data.hits === 'string' ? parseInt(data.hits, 10) : data.hits || 0,
      count: typeof data['count'] === 'string' ? parseInt(data['count'], 10) : data['count'] || 0,
      offset: typeof data.offset === 'string' ? parseInt(data.offset, 10) : data.offset || 0,
      items: items.map((item: any) => this.normalizeProduct(item)),
    };
  }

  /**
   * 作品データを正規化
   *
   * @param data 生の作品データ
   * @returns 正規化された作品データ
   */
  private normalizeProduct(data: any): DugaProduct {
    // APIレスポンスは items[].item の形式なので、item を取り出す
    const item = data.item || data;

    // サンプル画像を抽出 (thumbnail配列から)
    // DUGAの画像パス形式:
    //   小: https://pic.duga.jp/unsecure/xxx/noauth/scap/01.jpg
    //   大: https://pic.duga.jp/unsecure/xxx/noauth/sample/01.jpg
    const sampleImages: string[] = [];
    if (item['thumbnail'] && Array.isArray(item['thumbnail'])) {
      for (const thumb of item['thumbnail']) {
        const imageUrl = thumb.large || thumb.midium || thumb.image;
        if (imageUrl) {
          // /scap/ を /sample/ に変換して高解像度版を取得
          const fullSizeUrl = imageUrl.replace(/\/scap\//, '/sample/');
          sampleImages.push(fullSizeUrl);
        }
      }
    }

    // サンプル動画を抽出 (samplemovie配列から)
    const sampleVideos: string[] = [];
    if (item.samplemovie && Array.isArray(item.samplemovie)) {
      for (const sample of item.samplemovie) {
        // midium.movie または他の解像度のmovieを取得
        if (sample.midium?.movie) {
          sampleVideos.push(sample.midium.movie);
        } else if (sample.large?.movie) {
          sampleVideos.push(sample.large.movie);
        } else if (sample.small?.movie) {
          sampleVideos.push(sample.small.movie);
        }
      }
    }

    // ジャケット画像を抽出 (jacketimage配列から最大サイズを取得)
    let packageUrl: string | undefined;
    if (item.jacketimage && Array.isArray(item.jacketimage)) {
      const largeJacket = item.jacketimage.find((j: any) => j.large);
      const midiumJacket = item.jacketimage.find((j: any) => j.midium);
      const smallJacket = item.jacketimage.find((j: any) => j.small);
      packageUrl = largeJacket?.large || midiumJacket?.midium || smallJacket?.small;
    }

    // サムネイル画像を抽出 (posterimage配列から)
    let thumbnailUrl: string | undefined;
    if (item.posterimage && Array.isArray(item.posterimage)) {
      const largePoster = item.posterimage.find((p: any) => p.large);
      const midiumPoster = item.posterimage.find((p: any) => p.midium);
      const smallPoster = item.posterimage.find((p: any) => p.small);
      thumbnailUrl = largePoster?.large || midiumPoster?.midium || smallPoster?.small;
    }

    // 出演者情報を抽出 (performer配列から)
    const performers: Array<{ id: string; name: string }> = [];
    if (item.performer && Array.isArray(item.performer)) {
      for (const p of item.performer) {
        if (p.data) {
          performers.push({
            id: p.data['id'] || '',
            name: p.data['name'] || '',
          });
        }
      }
    }

    // カテゴリ情報を抽出 (category配列から)
    const categories: Array<{ id: string; name: string }> = [];
    if (item.category && Array.isArray(item.category)) {
      for (const c of item.category) {
        if (c.data) {
          categories.push({
            id: c.data['id'] || '',
            name: c.data['name'] || '',
          });
        }
      }
    }

    // レーベル情報を抽出
    let label: string | undefined;
    let labelId: string | undefined;
    if (item.label && Array.isArray(item.label) && item.label.length > 0) {
      label = item.label[0]['name'];
      labelId = item.label[0]['id'];
    }

    // シリーズ情報を抽出
    let series: string | undefined;
    let seriesId: string | undefined;
    if (item.series && Array.isArray(item.series) && item.series.length > 0) {
      series = item.series[0]['name'];
      seriesId = item.series[0]['id']?.toString();
    }

    // 価格を抽出 (saletype配列から通常版の価格を取得)
    let price: number | undefined;
    let saleInfo: DugaProduct['saleInfo'];
    if (item.saletype && Array.isArray(item.saletype)) {
      const normalType = item.saletype.find((s: any) => s.data?.type === '通常版');
      const hdType = item.saletype.find((s: any) => s.data?.type === 'HD版');
      const targetType = normalType || hdType || item.saletype[0];
      if (targetType?.data?.price) {
        price = parseInt(targetType.data['price'], 10);
      }

      // セール情報を抽出 (定価とセール価格が異なる場合)
      // DUGAのAPIではsaleprice, listprice, discountrateなどのフィールドがある場合がある
      if (targetType?.data) {
        const listPrice = targetType.data.listprice ? parseInt(targetType.data.listprice, 10) : undefined;
        const salePrice = targetType.data.saleprice ? parseInt(targetType.data.saleprice, 10) : price;
        const discountRate = targetType.data.discountrate ? parseInt(targetType.data.discountrate, 10) : undefined;

        if (listPrice && salePrice && listPrice > salePrice) {
          saleInfo = {
            regularPrice: listPrice,
            salePrice: salePrice,
            discountPercent: discountRate || Math.round((1 - salePrice / listPrice) * 100),
            saleType: 'sale',
          };
          price = salePrice; // 現在の価格はセール価格
        }
      }
    }

    // 日付をYYYY-MM-DD形式に変換
    const formatDate = (dateStr: string | undefined): string | undefined => {
      if (!dateStr) return undefined;
      // YYYY/MM/DD → YYYY-MM-DD
      return dateStr.replace(/\//g, '-');
    };

    const titleKana = item.title_kana || item.titleKana;
    const description = item.caption || item['description'];
    const finalThumbnailUrl = packageUrl || thumbnailUrl;
    const releaseDate = formatDate(item.releasedate || item.release_date);
    const openDate = formatDate(item.opendate || item.open_date);
    const duration = item.volume ? parseInt(item.volume, 10) : undefined;
    const salesType = item.sales_type || item.salesType;

    return {
      productId: item.productid || item.product_id || '',
      title: item['title'] || '',
      ...(titleKana && { titleKana }),
      ...(description && { description }),
      // ジャケット画像(packageUrl)を優先して使用（大サイズ）、なければポスター画像(thumbnailUrl)
      // jacketimage.large: 見開き大サイズ
      // posterimage.large: 240x180（最大でも小さい）
      ...(finalThumbnailUrl && { thumbnailUrl: finalThumbnailUrl }),
      ...(packageUrl && { packageUrl }),
      ...(sampleImages.length > 0 && { sampleImages }),
      ...(sampleVideos.length > 0 && { sampleVideos }),
      affiliateUrl: item.affiliateurl || item.affiliate_url || '',
      ...(price !== undefined && { price }),
      ...(releaseDate && { releaseDate }),
      ...(openDate && { openDate }),
      ...(duration !== undefined && { duration }),
      ...(label && { label }),
      ...(labelId && { labelId }),
      ...(series && { series }),
      ...(seriesId && { seriesId }),
      ...(performers.length > 0 && { performers }),
      ...(categories.length > 0 && { categories }),
      ...(salesType && { salesType }),
      ...(item.adult !== undefined && { adult: item.adult }),
      multiDevice: item.multi_device || item.multiDevice || false,
      ...(saleInfo && { saleInfo }),
    };
  }

  /**
   * キーワードで作品を検索
   *
   * @param keyword 検索キーワード
   * @param options 追加オプション
   * @returns 検索結果
   */
  async searchByKeyword(keyword: string, options: Partial<DugaSearchParams> = {}): Promise<DugaApiResponse> {
    return this.searchProducts({
      ...options,
      keyword,
    });
  }

  /**
   * 出演者IDで作品を検索
   *
   * @param performerId 出演者ID
   * @param options 追加オプション
   * @returns 検索結果
   */
  async searchByPerformer(performerId: string, options: Partial<DugaSearchParams> = {}): Promise<DugaApiResponse> {
    return this.searchProducts({
      ...options,
      performerid: performerId,
    });
  }

  /**
   * 新着作品を取得
   *
   * @param limit 取得件数
   * @param offset 開始位置
   * @returns 検索結果
   */
  async getNewReleases(limit: number = 20, offset: number = 0): Promise<DugaApiResponse> {
    return this.searchProducts({
      sort: 'new',
      hits: limit,
      offset,
      adult: 1,
    });
  }

  /**
   * 人気作品を取得
   *
   * @param limit 取得件数
   * @param offset 開始位置
   * @returns 検索結果
   */
  async getPopularProducts(limit: number = 20, offset: number = 0): Promise<DugaApiResponse> {
    return this.searchProducts({
      sort: 'favorite',
      hits: limit,
      offset,
      adult: 1,
    });
  }
}

/**
 * DUGAクライアントのシングルトンインスタンスを取得
 */
export function getDugaClient(): DugaApiClient {
  const appId = process.env['DUGA_APP_ID'];
  const agentId = process.env['DUGA_AGENT_ID'];
  const bannerId = process.env['DUGA_BANNER_ID'] || '01';

  if (!appId || !agentId) {
    throw new Error('DUGA_APP_ID and DUGA_AGENT_ID must be set in environment variables');
  }

  return new DugaApiClient({
    appId,
    agentId,
    bannerId,
  });
}
