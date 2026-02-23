/**
 * Admin Stats API Handler 統合テスト
 * ハンドラーの構造とレスポンス形式を検証
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAdminStatsHandler, type AdminStatsHandlerDeps, type ASPTotal } from '@adult-v/shared/api-handlers';

// モックASP Totals
const mockAspTotals: ASPTotal[] = [
  { asp: 'FANZA', apiTotal: 50000, source: 'API' },
  { asp: 'MGS', apiTotal: 20000, source: 'Web' },
];

// 全クエリ結果をまとめて返すモックDB
function createMockDb() {
  // Promise.allで並列実行されるため、各クエリに対応した結果を返す
  const queryResults = [
    // 1. ASP Summary
    {
      rows: [
        {
          asp_name: 'FANZA',
          total_products: '10000',
          with_image: '9500',
          image_pct: '95.0',
          with_video: '8000',
          video_pct: '80.0',
          with_performer: '7500',
          performer_pct: '75.0',
        },
      ],
    },
    // 2. Video Stats
    { rows: [{ asp_name: 'FANZA', total_videos: '50000', products_with_video: '8000' }] },
    // 3. Performer Stats
    {
      rows: [
        {
          total_performers: '5000',
          with_image: '4000',
          with_wiki: '0',
          with_products: '4500',
          total_links: '50000',
        },
      ],
    },
    // 4. Total Stats
    {
      rows: [
        {
          total_products: '15000',
          products_with_image: '13500',
          products_with_video: '11000',
          total_videos: '65000',
          products_with_performer: '12000',
        },
      ],
    },
    // 5. Top Performers
    { rows: [{ id: '1', name: '女優A', has_image: true, has_wiki: false, product_count: '500' }] },
    // 6. No Image Performers
    { rows: [{ id: '3', name: '女優C', product_count: '300' }] },
    // 7. Collection Rates
    { rows: [{ asp_name: 'FANZA', count: '10000' }] },
    // 8. Latest Releases
    { rows: [{ asp_name: 'FANZA', latest_release: '2024-01-15' }] },
    // 9. Daily Collection
    { rows: [{ date: '2024-01-15', asp_name: 'FANZA', count: '100' }] },
    // 10. Raw Data Counts
    { rows: [{ table_name: 'raw_html_data', count: '100000' }] },
    // 11. AI Content Stats (safeQuery)
    [
      {
        table_name: 'products',
        total: '15000',
        with_ai_description: '5000',
        with_ai_tags: '3000',
        with_ai_review: '2000',
        with_ai_catchphrase: '1000',
      },
    ],
    // 12. Performer AI Stats (safeQuery)
    [
      {
        total_performers: '5000',
        with_ai_review: '2000',
        with_height: '3000',
        with_measurements: '2500',
        with_birthday: '2000',
        with_social: '1500',
      },
    ],
    // 13. Translation Stats (safeQuery)
    [{ table_name: 'products', total: '15000', en: '10000', zh: '8000', zh_tw: '7000', ko: '6000' }],
    // 14. Table Row Counts (safeQuery)
    [{ table_name: 'products', count: '15000' }],
    // 15. ASP Totals - これはgetAllASPTotalsから来る
    // 16. Alias count
    { rows: [{ cnt: 1000 }] },
  ];

  let callIndex = 0;
  return {
    execute: vi.fn().mockImplementation(() => {
      const result = queryResults[callIndex] || { rows: [] };
      callIndex++;
      return Promise.resolve(result);
    }),
  };
}

describe('Admin Stats API Handler Integration', () => {
  describe('createAdminStatsHandler', () => {
    it('should create a handler function', () => {
      const deps: AdminStatsHandlerDeps = {
        getDb: () => createMockDb(),
        getAllASPTotals: vi.fn().mockResolvedValue(mockAspTotals),
        mapDBNameToASPName: vi.fn().mockImplementation((name: string) => name),
      };
      const handler = createAdminStatsHandler(deps);
      expect(typeof handler).toBe('function');
    });
  });

  describe('Error handling', () => {
    it('should return 500 on database error', async () => {
      const errorDeps: AdminStatsHandlerDeps = {
        getDb: () => ({
          execute: vi.fn().mockRejectedValue(new Error('DB Error')),
        }),
        getAllASPTotals: vi.fn().mockRejectedValue(new Error('ASP Error')),
        mapDBNameToASPName: vi.fn(),
      };

      const handler = createAdminStatsHandler(errorDeps);
      const response = await handler();

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to fetch stats');
    });
  });

  describe('Handler options', () => {
    it('should accept includeSeoIndexing option', () => {
      const deps: AdminStatsHandlerDeps = {
        getDb: () => createMockDb(),
        getAllASPTotals: vi.fn().mockResolvedValue(mockAspTotals),
        mapDBNameToASPName: vi.fn(),
      };

      // オプションを渡してもエラーにならないことを確認
      expect(() => createAdminStatsHandler(deps, { includeSeoIndexing: true })).not.toThrow();
      expect(() => createAdminStatsHandler(deps, { includeSeoIndexing: false })).not.toThrow();
    });
  });

  describe('Dependencies', () => {
    it('should call getDb to get database instance', async () => {
      const mockDb = createMockDb();
      const getDb = vi.fn().mockReturnValue(mockDb);
      const deps: AdminStatsHandlerDeps = {
        getDb,
        getAllASPTotals: vi.fn().mockResolvedValue(mockAspTotals),
        mapDBNameToASPName: vi.fn().mockImplementation((name: string) => name),
      };

      const handler = createAdminStatsHandler(deps);
      await handler();

      expect(getDb).toHaveBeenCalled();
    });

    it('should call getAllASPTotals for ASP estimates', async () => {
      const getAllASPTotals = vi.fn().mockResolvedValue(mockAspTotals);
      const deps: AdminStatsHandlerDeps = {
        getDb: () => createMockDb(),
        getAllASPTotals,
        mapDBNameToASPName: vi.fn().mockImplementation((name: string) => name),
      };

      const handler = createAdminStatsHandler(deps);
      await handler();

      expect(getAllASPTotals).toHaveBeenCalled();
    });
  });

  describe('Response status', () => {
    it('should return 200 status on success', async () => {
      const deps: AdminStatsHandlerDeps = {
        getDb: () => createMockDb(),
        getAllASPTotals: vi.fn().mockResolvedValue(mockAspTotals),
        mapDBNameToASPName: vi.fn().mockImplementation((name: string) => name),
      };

      const handler = createAdminStatsHandler(deps);
      const response = await handler();

      expect(response.status).toBe(200);
    });

    it('should return JSON content type', async () => {
      const deps: AdminStatsHandlerDeps = {
        getDb: () => createMockDb(),
        getAllASPTotals: vi.fn().mockResolvedValue(mockAspTotals),
        mapDBNameToASPName: vi.fn().mockImplementation((name: string) => name),
      };

      const handler = createAdminStatsHandler(deps);
      const response = await handler();
      const data = await response.json();

      // JSONとしてパースできることを確認
      expect(typeof data).toBe('object');
    });
  });
});

describe('Admin Stats Handler Types', () => {
  it('should export AdminStatsHandlerDeps type', () => {
    // 型が正しくexportされていることを確認
    const deps: AdminStatsHandlerDeps = {
      getDb: () => ({ execute: vi.fn() }),
      getAllASPTotals: vi.fn(),
      mapDBNameToASPName: vi.fn(),
    };
    expect(deps).toBeDefined();
  });

  it('should export ASPTotal type', () => {
    const aspTotal: ASPTotal = {
      asp: 'FANZA',
      apiTotal: 50000,
      source: 'API',
    };
    expect(aspTotal).toBeDefined();
    expect(aspTotal.asp).toBe('FANZA');
    expect(aspTotal.apiTotal).toBe(50000);
  });
});
