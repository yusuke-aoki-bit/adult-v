/**
 * ViewingHabitsDashboardコンポーネントのテスト
 * 視聴習慣ダッシュボードのテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewingHabitsDashboard } from '@adult-v/shared/components';

// localStorageのモック
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

describe('ViewingHabitsDashboard', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageMock);
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('表示', () => {
    it('データがない場合はメッセージを表示', () => {
      render(<ViewingHabitsDashboard locale="ja" />);

      expect(screen.getByText('まだ視聴履歴がありません')).toBeInTheDocument();
    });

    it('データがある場合はダッシュボードを表示', () => {
      const entries = [
        {
          id: '1',
          productId: 'p1',
          title: 'Product 1',
          imageUrl: null,
          aspName: 'fanza',
          viewedAt: Date.now(),
          createdAt: Date.now(),
        },
      ];
      localStorageMock.setItem('viewing_diary_adult-v', JSON.stringify(entries));

      render(<ViewingHabitsDashboard locale="ja" />);

      expect(screen.getByText('視聴習慣ダッシュボード')).toBeInTheDocument();
    });

    it('タイトルを表示', () => {
      const entries = [
        {
          id: '1',
          productId: 'p1',
          title: 'Product 1',
          imageUrl: null,
          aspName: 'fanza',
          viewedAt: Date.now(),
          createdAt: Date.now(),
        },
      ];
      localStorageMock.setItem('viewing_diary_adult-v', JSON.stringify(entries));

      render(<ViewingHabitsDashboard locale="ja" />);

      expect(screen.getByText('視聴習慣ダッシュボード')).toBeInTheDocument();
    });
  });

  describe('テーマ', () => {
    it('ダークテーマ（デフォルト）', () => {
      render(<ViewingHabitsDashboard locale="ja" theme="dark" />);

      const container = screen.getByText('まだ視聴履歴がありません').closest('div');
      expect(container?.className).toContain('bg-gray-800');
    });

    it('ライトテーマ', () => {
      render(<ViewingHabitsDashboard locale="ja" theme="light" />);

      const container = screen.getByText('まだ視聴履歴がありません').closest('div');
      expect(container?.className).toContain('bg-white');
    });
  });

  describe('ローカライズ', () => {
    it('日本語（デフォルト）', () => {
      render(<ViewingHabitsDashboard locale="ja" />);

      expect(screen.getByText('まだ視聴履歴がありません')).toBeInTheDocument();
    });

    it('英語', () => {
      render(<ViewingHabitsDashboard locale="en" />);

      expect(screen.getByText('No viewing history yet')).toBeInTheDocument();
    });
  });

  describe('統計表示', () => {
    const createEntries = (count: number) => {
      return Array.from({ length: count }, (_, i) => ({
        id: String(i),
        productId: `p${i}`,
        title: `Product ${i}`,
        imageUrl: null,
        aspName: 'fanza',
        performerName: i < 5 ? 'Performer A' : 'Performer B',
        performerId: i < 5 ? 1 : 2,
        tags: ['Tag1', 'Tag2'],
        duration: 120,
        rating: 4,
        viewedAt: Date.now() - i * 86400000, // 日ごとにずらす
        createdAt: Date.now() - i * 86400000,
      }));
    };

    it('視聴数を表示', () => {
      localStorageMock.setItem('viewing_diary_adult-v', JSON.stringify(createEntries(10)));

      render(<ViewingHabitsDashboard locale="ja" />);

      expect(screen.getByText('視聴数')).toBeInTheDocument();
    });

    it('視聴時間を表示', () => {
      localStorageMock.setItem('viewing_diary_adult-v', JSON.stringify(createEntries(10)));

      render(<ViewingHabitsDashboard locale="ja" />);

      expect(screen.getByText('視聴時間')).toBeInTheDocument();
    });

    it('平均評価を表示', () => {
      localStorageMock.setItem('viewing_diary_adult-v', JSON.stringify(createEntries(10)));

      render(<ViewingHabitsDashboard locale="ja" />);

      expect(screen.getByText('平均評価')).toBeInTheDocument();
    });

    it('視聴ストリークを表示', () => {
      localStorageMock.setItem('viewing_diary_adult-v', JSON.stringify(createEntries(10)));

      render(<ViewingHabitsDashboard locale="ja" />);

      expect(screen.getByText(/視聴ストリーク/)).toBeInTheDocument();
    });

    it('月別トレンドを表示', () => {
      localStorageMock.setItem('viewing_diary_adult-v', JSON.stringify(createEntries(10)));

      render(<ViewingHabitsDashboard locale="ja" />);

      expect(screen.getByText('月別視聴数')).toBeInTheDocument();
    });

    it('曜日別パターンを表示', () => {
      localStorageMock.setItem('viewing_diary_adult-v', JSON.stringify(createEntries(10)));

      render(<ViewingHabitsDashboard locale="ja" />);

      expect(screen.getByText('曜日別パターン')).toBeInTheDocument();
    });
  });

  describe('トップランキング', () => {
    const entries = [
      {
        id: '1',
        productId: 'p1',
        title: 'Product 1',
        imageUrl: null,
        aspName: 'fanza',
        performerName: 'Top Performer',
        performerId: 1,
        tags: ['Popular Tag'],
        viewedAt: Date.now(),
        createdAt: Date.now(),
      },
      {
        id: '2',
        productId: 'p2',
        title: 'Product 2',
        imageUrl: null,
        aspName: 'fanza',
        performerName: 'Top Performer',
        performerId: 1,
        tags: ['Popular Tag'],
        viewedAt: Date.now() - 86400000,
        createdAt: Date.now() - 86400000,
      },
    ];

    it('トップ出演者を表示', () => {
      localStorageMock.setItem('viewing_diary_adult-v', JSON.stringify(entries));

      render(<ViewingHabitsDashboard locale="ja" />);

      expect(screen.getByText('よく視聴した出演者')).toBeInTheDocument();
      expect(screen.getByText('Top Performer')).toBeInTheDocument();
    });

    it('トップジャンルを表示', () => {
      localStorageMock.setItem('viewing_diary_adult-v', JSON.stringify(entries));

      render(<ViewingHabitsDashboard locale="ja" />);

      expect(screen.getByText('よく視聴したジャンル')).toBeInTheDocument();
      expect(screen.getByText('Popular Tag')).toBeInTheDocument();
    });
  });

  describe('クリックイベント', () => {
    const entries = [
      {
        id: '1',
        productId: 'p1',
        title: 'Product 1',
        imageUrl: null,
        aspName: 'fanza',
        performerName: 'Clickable Performer',
        performerId: 123,
        tags: ['Clickable Tag'],
        viewedAt: Date.now(),
        createdAt: Date.now(),
      },
    ];

    it('出演者クリックでonPerformerClickが呼ばれる', () => {
      const onPerformerClick = vi.fn();
      localStorageMock.setItem('viewing_diary_adult-v', JSON.stringify(entries));

      render(
        <ViewingHabitsDashboard
          locale="ja"
          onPerformerClick={onPerformerClick}
        />
      );

      const performerButton = screen.getByText('Clickable Performer');
      fireEvent.click(performerButton);

      expect(onPerformerClick).toHaveBeenCalledWith(123, 'Clickable Performer');
    });

    it('タグクリックでonTagClickが呼ばれる', () => {
      const onTagClick = vi.fn();
      localStorageMock.setItem('viewing_diary_adult-v', JSON.stringify(entries));

      render(
        <ViewingHabitsDashboard
          locale="ja"
          onTagClick={onTagClick}
        />
      );

      const tagButton = screen.getByText('Clickable Tag');
      fireEvent.click(tagButton);

      expect(onTagClick).toHaveBeenCalledWith('Clickable Tag');
    });
  });

  describe('年選択', () => {
    it('複数年のデータがある場合はセレクターを表示', () => {
      const currentYear = new Date().getFullYear();
      const entries = [
        {
          id: '1',
          productId: 'p1',
          title: 'Product 1',
          imageUrl: null,
          aspName: 'fanza',
          viewedAt: Date.now(),
          createdAt: Date.now(),
        },
        {
          id: '2',
          productId: 'p2',
          title: 'Product 2',
          imageUrl: null,
          aspName: 'fanza',
          viewedAt: new Date(currentYear - 1, 6, 1).getTime(),
          createdAt: new Date(currentYear - 1, 6, 1).getTime(),
        },
      ];
      localStorageMock.setItem('viewing_diary_adult-v', JSON.stringify(entries));

      render(<ViewingHabitsDashboard locale="ja" />);

      // 年セレクターが存在することを確認
      const selector = screen.getByRole('combobox');
      expect(selector).toBeInTheDocument();
    });
  });
});
