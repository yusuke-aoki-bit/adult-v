# アフィリエイト統合検索サイト 設計書

## 1. システム概要

### 1.1 目的
複数のASP（アフィリエイトサービスプロバイダー）から商品データを取得し、出演者やタグで横断検索可能なアフィリエイトサイトを構築する。

### 1.2 主要機能
- 複数ASPのAPI・CSVデータの統合管理
- 同一作品の名寄せ処理
- 出演者・タグでの横断検索
- リアルタイム価格情報の取得
- キャッシュによる負荷軽減

---

## 2. システムアーキテクチャ

```
┌─────────────────────────────────────────┐
│         データソース層                     │
├─────────────────────────────────────────┤
│  ・ASP API (複数)                        │
│  ・CSV ファイル                           │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         ETL処理層                         │
├─────────────────────────────────────────┤
│  ・データ取得・正規化                      │
│  ・品番の正規化                           │
│  ・名寄せ処理（重複チェック）              │
│  ・出演者・タグの抽出                      │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│      データベース層 (GCP PostgreSQL)       │
├─────────────────────────────────────────┤
│  ・products (作品マスタ)                  │
│  ・product_sources (ASP別情報)            │
│  ・product_cache (価格・在庫キャッシュ)    │
│  ・performers (出演者)                    │
│  ・tags (タグ)                            │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         アプリケーション層                 │
├─────────────────────────────────────────┤
│  ・検索API                                │
│  ・フィルタリング機能                      │
│  ・キャッシュ管理                          │
│  ・リアルタイムAPI連携                     │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         フロントエンド層                   │
├─────────────────────────────────────────┤
│  ・React UI                              │
│  ・検索インターフェース                    │
│  ・結果表示                               │
└─────────────────────────────────────────┘
```

---

## 3. データベース設計

### 3.1 テーブル構成

#### products (作品マスタ)
名寄せ後の統合データを格納。

```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  normalized_product_id VARCHAR(100) UNIQUE NOT NULL,  -- 正規化された品番
  title VARCHAR(500) NOT NULL,
  release_date DATE,
  description TEXT,
  duration INT,  -- 再生時間（分）
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_products_normalized_id ON products(normalized_product_id);
CREATE INDEX idx_products_title ON products(title);
CREATE INDEX idx_products_release_date ON products(release_date DESC);
```

#### product_sources (ASP別商品情報)
各ASPごとの商品情報を保持。同一作品が複数ASPにある場合に対応。

```sql
CREATE TABLE product_sources (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  asp_name VARCHAR(50) NOT NULL,  -- 'DMM', 'MGS', 'DUGA' など
  original_product_id VARCHAR(100) NOT NULL,  -- ASPでの元の品番
  affiliate_url TEXT NOT NULL,
  price INT,
  data_source VARCHAR(10) NOT NULL,  -- 'API' or 'CSV'
  last_updated TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id, asp_name)
);

CREATE INDEX idx_sources_product ON product_sources(product_id);
CREATE INDEX idx_sources_asp ON product_sources(asp_name);
```

#### product_cache (動的情報キャッシュ)
APIから取得した価格・在庫などの頻繁に変わる情報をキャッシュ。

```sql
CREATE TABLE product_cache (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  asp_name VARCHAR(50) NOT NULL,
  price INT,
  sale_price INT,  -- セール価格
  in_stock BOOLEAN DEFAULT true,
  affiliate_url TEXT,
  thumbnail_url TEXT,
  sample_images JSONB,  -- サンプル画像のURL配列
  point_rate DECIMAL(5,2),  -- ポイント還元率
  cached_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id, asp_name)
);

CREATE INDEX idx_cache_freshness ON product_cache(product_id, asp_name, cached_at);
CREATE INDEX idx_cache_product ON product_cache(product_id);
```

#### performers (出演者)
```sql
CREATE TABLE performers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) UNIQUE NOT NULL,
  name_kana VARCHAR(200),  -- 読み仮名
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_performers_name ON performers(name);
CREATE INDEX idx_performers_kana ON performers(name_kana);
```

#### product_performers (作品-出演者 中間テーブル)
```sql
CREATE TABLE product_performers (
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  performer_id INT NOT NULL REFERENCES performers(id) ON DELETE CASCADE,
  PRIMARY KEY(product_id, performer_id)
);

CREATE INDEX idx_pp_product ON product_performers(product_id);
CREATE INDEX idx_pp_performer ON product_performers(performer_id);
```

#### tags (タグ/ジャンル)
```sql
CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  category VARCHAR(50),  -- 'genre', 'series', 'maker' など
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tags_name ON tags(name);
CREATE INDEX idx_tags_category ON tags(category);
```

#### product_tags (作品-タグ 中間テーブル)
```sql
CREATE TABLE product_tags (
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tag_id INT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY(product_id, tag_id)
);

CREATE INDEX idx_pt_product ON product_tags(product_id);
CREATE INDEX idx_pt_tag ON product_tags(tag_id);
```

---

## 4. データフロー設計

### 4.1 データ取得・名寄せフロー

```
[API/CSVデータ取得]
    ↓
[品番正規化] ← ここで名寄せ準備
    ↓
[既存作品チェック]
    ├─ 存在する → 既存product_idを使用
    └─ 存在しない → 新規作成
    ↓
[ASP別情報の登録/更新]
    ↓
[出演者・タグの紐付け]
    ↓
[完了]
```

### 4.2 品番正規化ロジック

```python
def normalize_product_id(product_id: str) -> str:
    """
    品番を正規化して統一フォーマットに変換
    
    例:
    "ABC-123" → "abc123"
    "ABC 123" → "abc123"
    "abc123"  → "abc123"
    """
    # 英数字のみ抽出、小文字化
    normalized = re.sub(r'[^a-zA-Z0-9]', '', product_id).lower()
    return normalized
```

### 4.3 データ取り込み処理

```python
def import_product(source_data: dict, asp_name: str, data_source: str):
    """
    商品データを取り込み、名寄せを実行
    
    Args:
        source_data: APIまたはCSVから取得したデータ
        asp_name: ASP名 (例: 'DMM', 'MGS')
        data_source: 'API' or 'CSV'
    """
    # 1. 品番を正規化
    normalized_id = normalize_product_id(source_data['product_id'])
    
    # 2. 既存作品を検索（名寄せチェック）
    existing = db.query_one("""
        SELECT id FROM products 
        WHERE normalized_product_id = %s
    """, [normalized_id])
    
    if existing:
        # 既存作品 - IDを取得
        product_id = existing['id']
        
        # タイトルなど基本情報を更新（より詳細な情報があれば）
        db.execute("""
            UPDATE products 
            SET title = COALESCE(%s, title),
                release_date = COALESCE(%s, release_date),
                description = COALESCE(%s, description),
                updated_at = NOW()
            WHERE id = %s
        """, [source_data.get('title'), 
              source_data.get('release_date'),
              source_data.get('description'),
              product_id])
    else:
        # 新規作品 - マスタに追加
        product_id = db.execute("""
            INSERT INTO products 
            (normalized_product_id, title, release_date, description)
            VALUES (%s, %s, %s, %s)
            RETURNING id
        """, [normalized_id, 
              source_data['title'], 
              source_data.get('release_date'),
              source_data.get('description')])
    
    # 3. ASP別情報を追加/更新（UPSERT）
    db.execute("""
        INSERT INTO product_sources 
        (product_id, asp_name, original_product_id, 
         affiliate_url, price, data_source, last_updated)
        VALUES (%s, %s, %s, %s, %s, %s, NOW())
        ON CONFLICT (product_id, asp_name)
        DO UPDATE SET
            original_product_id = EXCLUDED.original_product_id,
            affiliate_url = EXCLUDED.affiliate_url,
            price = EXCLUDED.price,
            data_source = EXCLUDED.data_source,
            last_updated = NOW()
    """, [product_id, asp_name, source_data['product_id'],
          source_data['affiliate_url'], source_data.get('price'),
          data_source])
    
    # 4. 出演者を紐付け
    for performer_name in source_data.get('performers', []):
        performer_id = get_or_create_performer(performer_name)
        link_performer(product_id, performer_id)
    
    # 5. タグを紐付け
    for tag_name in source_data.get('tags', []):
        tag_id = get_or_create_tag(tag_name)
        link_tag(product_id, tag_id)
    
    return product_id


def get_or_create_performer(name: str) -> int:
    """出演者を取得または作成"""
    existing = db.query_one("""
        SELECT id FROM performers WHERE name = %s
    """, [name])
    
    if existing:
        return existing['id']
    
    return db.execute("""
        INSERT INTO performers (name)
        VALUES (%s)
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
    """, [name])


def link_performer(product_id: int, performer_id: int):
    """作品と出演者を紐付け"""
    db.execute("""
        INSERT INTO product_performers (product_id, performer_id)
        VALUES (%s, %s)
        ON CONFLICT DO NOTHING
    """, [product_id, performer_id])
```

---

## 5. 検索・表示フロー

### 5.1 検索処理の流れ

```
[ユーザー検索クエリ]
    ↓
[DBで高速フィルタリング]
・タイトル検索
・出演者検索
・タグ検索
    ↓
[検索結果の作品ID取得]
    ↓
[各作品の詳細情報取得]
    ├─ キャッシュあり（新しい）→ キャッシュから返却
    └─ キャッシュなし/古い → API叩いて取得 → キャッシュ更新
    ↓
[複数ASPの情報をマージ]
    ↓
[結果を返却]
```

### 5.2 検索API実装例

```python
async def search_products(
    query: str = None,
    performer_name: str = None,
    tag_names: list = None,
    limit: int = 50,
    offset: int = 0
) -> list:
    """
    作品を検索
    
    Args:
        query: タイトル検索クエリ
        performer_name: 出演者名
        tag_names: タグ名のリスト
        limit: 取得件数
        offset: オフセット
    """
    # 1. DBで作品を検索
    sql = """
        SELECT DISTINCT p.id, p.normalized_product_id, p.title, 
               p.release_date, p.description,
               array_agg(DISTINCT ps.asp_name) as available_asps
        FROM products p
        JOIN product_sources ps ON p.id = ps.product_id
        WHERE 1=1
    """
    params = []
    
    # タイトル検索
    if query:
        sql += " AND p.title LIKE %s"
        params.append(f"%{query}%")
    
    # 出演者検索
    if performer_name:
        sql += """
            AND EXISTS (
                SELECT 1 FROM product_performers pp
                JOIN performers pf ON pp.performer_id = pf.id
                WHERE pp.product_id = p.id 
                  AND pf.name LIKE %s
            )
        """
        params.append(f"%{performer_name}%")
    
    # タグ検索
    if tag_names:
        sql += """
            AND EXISTS (
                SELECT 1 FROM product_tags pt
                JOIN tags t ON pt.tag_id = t.id
                WHERE pt.product_id = p.id 
                  AND t.name = ANY(%s)
            )
        """
        params.append(tag_names)
    
    sql += """
        GROUP BY p.id
        ORDER BY p.release_date DESC
        LIMIT %s OFFSET %s
    """
    params.extend([limit, offset])
    
    products = await db.query(sql, params)
    
    # 2. 各作品の詳細情報を取得（キャッシュ優先）
    result = []
    for product in products:
        # ASP別の詳細情報を取得
        asp_details = await asyncio.gather(*[
            get_product_details(product['id'], asp_name)
            for asp_name in product['available_asps']
        ])
        
        # 出演者・タグ情報を取得
        performers = await get_product_performers(product['id'])
        tags = await get_product_tags(product['id'])
        
        result.append({
            'id': product['id'],
            'product_id': product['normalized_product_id'],
            'title': product['title'],
            'release_date': product['release_date'],
            'description': product['description'],
            'performers': performers,
            'tags': tags,
            'pricing': asp_details  # 各ASPの価格・URL情報
        })
    
    return result
```

### 5.3 キャッシュ管理

```python
async def get_product_details(
    product_id: int, 
    asp_name: str, 
    cache_ttl: int = 3600  # デフォルト1時間
) -> dict:
    """
    商品詳細を取得（キャッシュ優先）
    
    Args:
        product_id: 作品ID
        asp_name: ASP名
        cache_ttl: キャッシュの有効期限（秒）
    """
    # 1. キャッシュをチェック
    cached = await db.query_one(f"""
        SELECT * FROM product_cache
        WHERE product_id = %s 
          AND asp_name = %s
          AND cached_at > NOW() - INTERVAL '{cache_ttl} seconds'
    """, [product_id, asp_name])
    
    if cached:
        return {
            'asp_name': asp_name,
            'price': cached['price'],
            'sale_price': cached['sale_price'],
            'in_stock': cached['in_stock'],
            'affiliate_url': cached['affiliate_url'],
            'thumbnail_url': cached['thumbnail_url'],
            'sample_images': cached['sample_images'],
            'point_rate': cached['point_rate'],
            'source': 'cache',
            'cached_at': cached['cached_at']
        }
    
    # 2. キャッシュがない/古い → APIから取得
    try:
        fresh_data = await call_asp_api(asp_name, product_id)
        
        # 3. キャッシュを更新
        await db.execute("""
            INSERT INTO product_cache 
            (product_id, asp_name, price, sale_price, in_stock, 
             affiliate_url, thumbnail_url, sample_images, point_rate, cached_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (product_id, asp_name)
            DO UPDATE SET
                price = EXCLUDED.price,
                sale_price = EXCLUDED.sale_price,
                in_stock = EXCLUDED.in_stock,
                affiliate_url = EXCLUDED.affiliate_url,
                thumbnail_url = EXCLUDED.thumbnail_url,
                sample_images = EXCLUDED.sample_images,
                point_rate = EXCLUDED.point_rate,
                cached_at = NOW()
        """, [product_id, asp_name, fresh_data['price'], 
              fresh_data.get('sale_price'), fresh_data['in_stock'],
              fresh_data['affiliate_url'], fresh_data['thumbnail_url'],
              json.dumps(fresh_data.get('sample_images', [])),
              fresh_data.get('point_rate')])
        
        return {**fresh_data, 'source': 'api'}
    
    except Exception as e:
        # API呼び出し失敗時は古いキャッシュでも返す
        old_cache = await db.query_one("""
            SELECT * FROM product_cache
            WHERE product_id = %s AND asp_name = %s
        """, [product_id, asp_name])
        
        if old_cache:
            return {
                **old_cache,
                'source': 'stale_cache',
                'error': str(e)
            }
        
        raise
```

---

## 6. API連携設計

### 6.1 ASP API抽象化レイヤー

各ASPのAPIの違いを吸収する共通インターフェース。

```python
from abc import ABC, abstractmethod

class ASPAPIClient(ABC):
    """ASP API の抽象基底クラス"""
    
    @abstractmethod
    async def search_products(self, query: str) -> list:
        """商品検索"""
        pass
    
    @abstractmethod
    async def get_product_detail(self, product_id: str) -> dict:
        """商品詳細取得"""
        pass
    
    @abstractmethod
    def normalize_response(self, raw_data: dict) -> dict:
        """レスポンスを統一フォーマットに正規化"""
        pass


class DMMAPIClient(ASPAPIClient):
    """DMM API クライアント"""
    
    def __init__(self, api_id: str, affiliate_id: str):
        self.api_id = api_id
        self.affiliate_id = affiliate_id
        self.base_url = "https://api.dmm.com/affiliate/v3/"
    
    async def search_products(self, query: str) -> list:
        url = f"{self.base_url}ItemList"
        params = {
            'api_id': self.api_id,
            'affiliate_id': self.affiliate_id,
            'site': 'FANZA',
            'keyword': query,
            'hits': 100
        }
        response = await http_client.get(url, params=params)
        return [self.normalize_response(item) for item in response['items']]
    
    async def get_product_detail(self, product_id: str) -> dict:
        url = f"{self.base_url}ItemList"
        params = {
            'api_id': self.api_id,
            'affiliate_id': self.affiliate_id,
            'site': 'FANZA',
            'cid': product_id
        }
        response = await http_client.get(url, params=params)
        return self.normalize_response(response['items'][0])
    
    def normalize_response(self, raw_data: dict) -> dict:
        """DMMのレスポンスを統一フォーマットに変換"""
        return {
            'product_id': raw_data['content_id'],
            'title': raw_data['title'],
            'price': raw_data.get('price', {}).get('price'),
            'sale_price': raw_data.get('price', {}).get('list_price'),
            'release_date': raw_data.get('date'),
            'affiliate_url': raw_data['affiliateURL'],
            'thumbnail_url': raw_data['imageURL']['large'],
            'sample_images': [img['image_url']['large'] 
                            for img in raw_data.get('sampleImageURL', {}).get('sample_s', {}).get('image', [])],
            'performers': [p['name'] for p in raw_data.get('iteminfo', {}).get('actress', [])],
            'tags': [g['name'] for g in raw_data.get('iteminfo', {}).get('genre', [])],
            'in_stock': True,
            'description': raw_data.get('comment')
        }


class MGSAPIClient(ASPAPIClient):
    """MGS API クライアント（実装例）"""
    # 同様に実装
    pass


# ASPクライアントファクトリー
def get_asp_client(asp_name: str) -> ASPAPIClient:
    """ASP名からクライアントインスタンスを取得"""
    clients = {
        'DMM': DMMAPIClient(
            api_id=config.DMM_API_ID,
            affiliate_id=config.DMM_AFFILIATE_ID
        ),
        'MGS': MGSAPIClient(
            api_key=config.MGS_API_KEY
        ),
        # 他のASPも追加
    }
    return clients.get(asp_name)


async def call_asp_api(asp_name: str, product_id: str) -> dict:
    """統一インターフェースでASP APIを呼び出し"""
    client = get_asp_client(asp_name)
    if not client:
        raise ValueError(f"Unknown ASP: {asp_name}")
    
    return await client.get_product_detail(product_id)
```

### 6.2 レート制限対策

```python
import asyncio
from collections import defaultdict
from datetime import datetime, timedelta

class RateLimiter:
    """APIレート制限管理"""
    
    def __init__(self):
        self.requests = defaultdict(list)  # asp_name -> [timestamps]
        self.limits = {
            'DMM': (100, 60),  # 100リクエスト/分
            'MGS': (60, 60),   # 60リクエスト/分
        }
    
    async def acquire(self, asp_name: str):
        """レート制限を考慮して待機"""
        if asp_name not in self.limits:
            return
        
        max_requests, window_seconds = self.limits[asp_name]
        now = datetime.now()
        cutoff = now - timedelta(seconds=window_seconds)
        
        # 古いリクエスト記録を削除
        self.requests[asp_name] = [
            ts for ts in self.requests[asp_name] 
            if ts > cutoff
        ]
        
        # レート制限チェック
        if len(self.requests[asp_name]) >= max_requests:
            # 最も古いリクエストから window_seconds 経過するまで待機
            oldest = self.requests[asp_name][0]
            wait_until = oldest + timedelta(seconds=window_seconds)
            wait_seconds = (wait_until - now).total_seconds()
            if wait_seconds > 0:
                await asyncio.sleep(wait_seconds)
        
        # リクエスト記録を追加
        self.requests[asp_name].append(now)

rate_limiter = RateLimiter()

async def call_asp_api_with_rate_limit(asp_name: str, product_id: str) -> dict:
    """レート制限を考慮したAPI呼び出し"""
    await rate_limiter.acquire(asp_name)
    return await call_asp_api(asp_name, product_id)
```

---

## 7. CSV取り込み処理

### 7.1 CSV形式

```csv
product_id,title,release_date,price,affiliate_url,performers,tags,description
ABC-123,"サンプル作品1",2024-01-15,3980,https://...,出演者A|出演者B,ジャンル1|ジャンル2,"説明文..."
DEF-456,"サンプル作品2",2024-01-20,4980,https://...,出演者C,ジャンル3,"説明文..."
```

### 7.2 CSV取り込みスクリプト

```python
import csv
from datetime import datetime

async def import_csv(file_path: str, asp_name: str):
    """
    CSVファイルから商品データを取り込み
    
    Args:
        file_path: CSVファイルパス
        asp_name: ASP名
    """
    imported_count = 0
    error_count = 0
    
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            try:
                # データを整形
                source_data = {
                    'product_id': row['product_id'],
                    'title': row['title'],
                    'release_date': datetime.strptime(row['release_date'], '%Y-%m-%d').date() 
                                   if row.get('release_date') else None,
                    'price': int(row['price']) if row.get('price') else None,
                    'affiliate_url': row['affiliate_url'],
                    'performers': [p.strip() for p in row.get('performers', '').split('|') if p.strip()],
                    'tags': [t.strip() for t in row.get('tags', '').split('|') if t.strip()],
                    'description': row.get('description')
                }
                
                # データ取り込み（名寄せ処理含む）
                import_product(source_data, asp_name, 'CSV')
                imported_count += 1
                
            except Exception as e:
                print(f"Error importing row: {row.get('product_id')} - {e}")
                error_count += 1
    
    print(f"CSV import completed: {imported_count} imported, {error_count} errors")
    return imported_count, error_count
```

---

## 8. GCP環境構成

### 8.1 使用サービス

- **Cloud SQL (PostgreSQL)**: データベース
- **Cloud Functions**: API取得・CSV取り込み処理
- **Cloud Scheduler**: 定期実行
- **Cloud Storage**: CSVファイル保管
- **Cloud Run**: アプリケーションAPI（検索など）

### 8.2 定期実行設計

```yaml
# Cloud Scheduler設定例

# DMM API 定期取得（1時間ごと）
- name: fetch-dmm-api
  schedule: "0 * * * *"  # 毎時0分
  target: cloud-function-fetch-dmm
  
# MGS API 定期取得（1時間ごと）
- name: fetch-mgs-api
  schedule: "15 * * * *"  # 毎時15分
  target: cloud-function-fetch-mgs

# 人気作品のキャッシュ更新（30分ごと）
- name: refresh-popular-cache
  schedule: "*/30 * * * *"
  target: cloud-function-refresh-cache

# 古いキャッシュのクリーンアップ（毎日深夜）
- name: cleanup-old-cache
  schedule: "0 3 * * *"  # 毎日3時
  target: cloud-function-cleanup
```

### 8.3 Cloud Function例（API取得）

```python
import functions_framework
from google.cloud import sql_connector

@functions_framework.http
def fetch_dmm_products(request):
    """DMMから新着商品を取得してDBに保存"""
    try:
        # DMM APIクライアント初期化
        client = DMMAPIClient(
            api_id=os.environ['DMM_API_ID'],
            affiliate_id=os.environ['DMM_AFFILIATE_ID']
        )
        
        # 新着商品を取得
        products = await client.search_products(query='', sort='date')
        
        # DBに保存
        imported = 0
        for product in products:
            import_product(product, 'DMM', 'API')
            imported += 1
        
        return {
            'status': 'success',
            'imported': imported
        }, 200
        
    except Exception as e:
        return {
            'status': 'error',
            'message': str(e)
        }, 500
```

---

## 9. フロントエンド設計

### 9.1 React コンポーネント構成

```
App
├─ SearchBar (検索バー)
├─ FilterPanel (出演者・タグフィルター)
└─ ProductList (検索結果)
    └─ ProductCard (個別商品)
        ├─ ProductInfo (商品情報)
        ├─ PerformerList (出演者リスト)
        └─ PriceComparison (ASP別価格比較)
```

### 9.2 検索インターフェース例

```jsx
import React, { useState } from 'react';

function SearchPage() {
  const [query, setQuery] = useState('');
  const [performer, setPerformer] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          performer,
          tags: selectedTags
        })
      });
      const data = await response.json();
      setResults(data.results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="search-page">
      <div className="search-bar">
        <input 
          type="text" 
          placeholder="作品タイトルで検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <input 
          type="text" 
          placeholder="出演者名"
          value={performer}
          onChange={(e) => setPerformer(e.target.value)}
        />
        <button onClick={handleSearch}>検索</button>
      </div>
      
      <FilterPanel 
        selectedTags={selectedTags}
        onTagChange={setSelectedTags}
      />
      
      {loading ? (
        <div>検索中...</div>
      ) : (
        <ProductList results={results} />
      )}
    </div>
  );
}
```

---

## 10. 運用・監視

### 10.1 監視項目

- **API呼び出し状況**
  - 成功率
  - レスポンス時間
  - レート制限到達回数

- **キャッシュ効率**
  - ヒット率
  - 平均TTL

- **データ品質**
  - 名寄せ成功率
  - 重複作品数
  - 欠損データ数

### 10.2 ログ設計

```python
import logging
from google.cloud import logging as cloud_logging

# Cloud Logging設定
client = cloud_logging.Client()
client.setup_logging()

logger = logging.getLogger(__name__)

# ログ例
logger.info('Product imported', extra={
    'product_id': product_id,
    'asp_name': asp_name,
    'data_source': data_source,
    'normalized_id': normalized_id,
    'is_new': is_new_product
})

logger.warning('Cache miss', extra={
    'product_id': product_id,
    'asp_name': asp_name,
    'age_seconds': cache_age
})

logger.error('API call failed', extra={
    'asp_name': asp_name,
    'error': str(error),
    'retry_count': retry_count
})
```

### 10.3 メンテナンス作業

#### 定期チェック項目
- 名寄せ漏れの確認・修正
- 古いキャッシュのクリーンアップ
- 孤立レコードの削除
- インデックスの最適化

```sql
-- 名寄せ漏れチェック（同一タイトルが複数マスタに）
SELECT title, COUNT(*) as count
FROM products
GROUP BY title
HAVING COUNT(*) > 1;

-- 孤立した出演者レコード削除
DELETE FROM performers
WHERE id NOT IN (SELECT DISTINCT performer_id FROM product_performers);

-- 古いキャッシュ削除（7日以上前）
DELETE FROM product_cache
WHERE cached_at < NOW() - INTERVAL '7 days';
```

---

## 11. セキュリティ考慮事項

### 11.1 APIキー管理
- **Secret Manager** を使用してAPIキーを管理
- 環境変数経由で読み込み
- コードにハードコードしない

### 11.2 アクセス制御
- Cloud SQL は Private IP で接続
- Cloud Functions は認証必須
- フロントエンドは HTTPS のみ

### 11.3 データ保護
- 個人情報（メールアドレスなど）は保存しない
- アフィリエイトURLは定期的に検証
- SQL インジェクション対策（プレースホルダー使用）

---

## 12. パフォーマンス最適化

### 12.1 データベース最適化

```sql
-- 検索パフォーマンス向上のための複合インデックス
CREATE INDEX idx_products_search 
ON products(release_date DESC, title);

-- 全文検索用インデックス（オプション）
CREATE INDEX idx_products_title_gin 
ON products USING gin(to_tsvector('japanese', title));

-- パーティショニング（大規模データ向け）
CREATE TABLE products_2024 PARTITION OF products
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
```

### 12.2 キャッシュ戦略

| データ種別 | TTL | 更新タイミング |
|-----------|-----|--------------|
| 価格情報 | 1時間 | リアルタイム更新 |
| サムネイル | 24時間 | バッチ更新 |
| 在庫状況 | 30分 | リアルタイム更新 |
| 出演者情報 | 1週間 | バッチ更新 |

### 12.3 API呼び出し最適化

```python
# 並列処理でAPI呼び出しを高速化
async def fetch_multiple_asps(product_id: int, asp_names: list):
    """複数ASPのAPIを並列で呼び出し"""
    tasks = [
        call_asp_api_with_rate_limit(asp, product_id)
        for asp in asp_names
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # エラーハンドリング
    return [
        result if not isinstance(result, Exception) else None
        for result in results
    ]
```

---

## 13. 拡張性・将来対応

### 13.1 追加機能候補
- ユーザーレビュー・評価機能
- お気に入り登録
- 価格変動アラート
- レコメンド機能（機械学習ベース）
- サンプル動画プレビュー

### 13.2 スケーラビリティ
- Cloud SQL のリードレプリカ追加
- Redis によるセッションキャッシュ
- CDN（Cloud CDN）による画像配信
- Cloud Load Balancing

---

## 付録A: 環境変数設定例

```bash
# .env.example

# Database
DB_HOST=xxx.xxx.xxx.xxx
DB_PORT=5432
DB_NAME=affiliate_db
DB_USER=app_user
DB_PASSWORD=xxxxx

# DMM API
DMM_API_ID=xxxxx
DMM_AFFILIATE_ID=xxxxx

# MGS API
MGS_API_KEY=xxxxx

# Cache Settings
CACHE_TTL_PRICE=3600
CACHE_TTL_THUMBNAIL=86400
CACHE_TTL_STOCK=1800

# Rate Limits
RATE_LIMIT_DMM=100
RATE_LIMIT_MGS=60
```

---

## 付録B: デプロイ手順

```bash
# 1. データベースセットアップ
gcloud sql instances create affiliate-db \
  --database-version=POSTGRES_14 \
  --tier=db-f1-micro \
  --region=asia-northeast1

# 2. データベース作成
gcloud sql databases create affiliate_db --instance=affiliate-db

# 3. スキーマ適用
psql -h [DB_HOST] -U postgres -d affiliate_db -f schema.sql

# 4. Cloud Functions デプロイ
gcloud functions deploy fetch-dmm-api \
  --runtime python39 \
  --trigger-http \
  --entry-point fetch_dmm_products \
  --region asia-northeast1

# 5. Cloud Scheduler 設定
gcloud scheduler jobs create http fetch-dmm-job \
  --schedule "0 * * * *" \
  --uri https://[REGION]-[PROJECT].cloudfunctions.net/fetch-dmm-api \
  --http-method POST
```

---

以上
