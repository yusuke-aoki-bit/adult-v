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

  constructor(config: {
    appId: string;
    agentId: string;
    bannerId?: string;
    baseUrl?: string;
  }) {
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
    while (this.requestTimestamps.length > 0 && this.requestTimestamps[0] < sixtySecondsAgo) {
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
      format: params.format || 'json',
      timestamp: Date.now().toString(),
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
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'DUGA-API-Client/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`DUGA API error: ${response.status} ${response.statusText}`);
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
    // APIのレスポンス構造に応じて調整が必要
    // 以下は想定される構造の例
    return {
      hits: data.hits || 0,
      count: data.count || 0,
      offset: data.offset || 0,
      items: (data.items || data.products || []).map((item: any) => this.normalizeProduct(item)),
    };
  }

  /**
   * 作品データを正規化
   *
   * @param data 生の作品データ
   * @returns 正規化された作品データ
   */
  private normalizeProduct(data: any): DugaProduct {
    return {
      productId: data.product_id || data.productId || '',
      title: data.title || '',
      titleKana: data.title_kana || data.titleKana,
      description: data.description || data.desc,
      thumbnailUrl: data.thumbnail_url || data.thumbnailUrl || data.thumb,
      packageUrl: data.package_url || data.packageUrl || data.package,
      sampleImages: data.sample_images || data.sampleImages || data.images || [],
      sampleVideos: data.sample_videos || data.sampleVideos || data.videos || [],
      affiliateUrl: data.affiliate_url || data.affiliateUrl || data.url || '',
      price: data.price ? parseInt(data.price, 10) : undefined,
      releaseDate: data.release_date || data.releaseDate,
      openDate: data.open_date || data.openDate,
      duration: data.duration ? parseInt(data.duration, 10) : undefined,
      label: data.label || data.label_name,
      labelId: data.label_id || data.labelId,
      series: data.series || data.series_name,
      seriesId: data.series_id || data.seriesId,
      performers: (data.performers || data.actresses || []).map((p: any) => ({
        id: p.id || p.performer_id,
        name: p.name || p.performer_name,
      })),
      categories: (data.categories || data.tags || []).map((c: any) => ({
        id: c.id || c.category_id,
        name: c.name || c.category_name,
      })),
      salesType: data.sales_type || data.salesType,
      adult: data.adult,
      multiDevice: data.multi_device || data.multiDevice || false,
    };
  }

  /**
   * キーワードで作品を検索
   *
   * @param keyword 検索キーワード
   * @param options 追加オプション
   * @returns 検索結果
   */
  async searchByKeyword(
    keyword: string,
    options: Partial<DugaSearchParams> = {}
  ): Promise<DugaApiResponse> {
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
  async searchByPerformer(
    performerId: string,
    options: Partial<DugaSearchParams> = {}
  ): Promise<DugaApiResponse> {
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
  const appId = process.env.DUGA_APP_ID;
  const agentId = process.env.DUGA_AGENT_ID;
  const bannerId = process.env.DUGA_BANNER_ID || '01';

  if (!appId || !agentId) {
    throw new Error('DUGA_APP_ID and DUGA_AGENT_ID must be set in environment variables');
  }

  return new DugaApiClient({
    appId,
    agentId,
    bannerId,
  });
}
