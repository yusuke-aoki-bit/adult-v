/**
 * Paginationコンポーネントのテスト
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Pagination from '@adult-v/shared/components/Pagination';

// next/navigationのモック
const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useParams: () => ({ locale: 'ja' }),
  useRouter: () => ({ push: mockPush }),
}));

// next/linkのモック
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    className,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
}));

// テーマ関連のモック
vi.mock('@adult-v/shared/lib/theme', () => ({
  getThemeMode: () => 'light',
  getPrimaryColor: () => 'rose',
}));

// useReducedMotionのモック
vi.mock('@adult-v/shared/lib/hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

describe('Pagination', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  describe('基本レンダリング', () => {
    it('1ページのみの場合は何も表示しない', () => {
      const { container } = render(<Pagination total={10} page={1} perPage={20} basePath="/products" />);

      expect(container.querySelector('nav')).toBeNull();
    });

    it('複数ページある場合はナビゲーションを表示', () => {
      render(<Pagination total={100} page={1} perPage={10} basePath="/products" />);

      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('前へ・次へボタンを表示', () => {
      render(<Pagination total={100} page={5} perPage={10} basePath="/products" />);

      expect(screen.getByText('前へ')).toBeInTheDocument();
      expect(screen.getByText('次へ')).toBeInTheDocument();
    });

    it('最初・最後ボタンを表示', () => {
      render(<Pagination total={100} page={5} perPage={10} basePath="/products" />);

      expect(screen.getByText('最初')).toBeInTheDocument();
      expect(screen.getByText('最後')).toBeInTheDocument();
    });
  });

  describe('ページ番号表示', () => {
    it('現在のページをハイライト', () => {
      render(<Pagination total={100} page={5} perPage={10} basePath="/products" />);

      const currentPage = screen.getByText('5');
      expect(currentPage).toHaveAttribute('aria-current', 'page');
    });

    it('ページ番号リンクを生成', () => {
      render(<Pagination total={50} page={1} perPage={10} basePath="/products" />);

      // 5ページあるはず
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('省略記号（...）を表示', () => {
      render(<Pagination total={1000} page={50} perPage={10} basePath="/products" />);

      // 中央のページでは両端に省略記号
      const dots = screen.getAllByText('...');
      expect(dots.length).toBeGreaterThan(0);
    });
  });

  describe('リンク生成', () => {
    it('ベースパスからリンクを生成', () => {
      render(<Pagination total={100} page={1} perPage={10} basePath="/products" />);

      const nextLink = screen.getByText('次へ').closest('a');
      expect(nextLink).toHaveAttribute('href', '/products?page=2');
    });

    it('page=1の場合はpageパラメータを省略', () => {
      render(<Pagination total={100} page={2} perPage={10} basePath="/products" />);

      const page1Link = screen.getByText('1').closest('a');
      expect(page1Link).toHaveAttribute('href', '/products');
    });

    it('クエリパラメータを保持', () => {
      render(
        <Pagination
          total={100}
          page={1}
          perPage={10}
          basePath="/products"
          queryParams={{ sort: 'date', filter: 'active' }}
        />,
      );

      const nextLink = screen.getByText('次へ').closest('a');
      expect(nextLink?.getAttribute('href')).toContain('sort=date');
      expect(nextLink?.getAttribute('href')).toContain('filter=active');
    });
  });

  describe('無効化状態', () => {
    it('最初のページで前へボタンを無効化', () => {
      render(<Pagination total={100} page={1} perPage={10} basePath="/products" />);

      const prevButton = screen.getByText('前へ').closest('a');
      expect(prevButton).toHaveAttribute('aria-disabled', 'true');
    });

    it('最初のページで最初ボタンを無効化', () => {
      render(<Pagination total={100} page={1} perPage={10} basePath="/products" />);

      const firstButton = screen.getByText('最初').closest('a');
      expect(firstButton).toHaveAttribute('aria-disabled', 'true');
    });

    it('最後のページで次へボタンを無効化', () => {
      render(<Pagination total={100} page={10} perPage={10} basePath="/products" />);

      const nextButton = screen.getByText('次へ').closest('a');
      expect(nextButton).toHaveAttribute('aria-disabled', 'true');
    });

    it('最後のページで最後ボタンを無効化', () => {
      render(<Pagination total={100} page={10} perPage={10} basePath="/products" />);

      const lastButton = screen.getByText('最後').closest('a');
      expect(lastButton).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('ジャンプボタン（10ページ超の場合）', () => {
    it('10ページ以下ではジャンプボタンを表示しない', () => {
      render(<Pagination total={100} page={5} perPage={10} basePath="/products" />);

      expect(screen.queryByText('-10')).not.toBeInTheDocument();
      expect(screen.queryByText('+10')).not.toBeInTheDocument();
    });

    it('10ページ超でジャンプボタンを表示', () => {
      render(<Pagination total={200} page={10} perPage={10} basePath="/products" />);

      expect(screen.getByText('-10')).toBeInTheDocument();
      expect(screen.getByText('+10')).toBeInTheDocument();
    });

    it('-10ジャンプが無効の場合（ページ10以下）', () => {
      render(<Pagination total={200} page={5} perPage={10} basePath="/products" />);

      const jumpBackButton = screen.getByText('-10').closest('a');
      expect(jumpBackButton).toHaveAttribute('aria-disabled', 'true');
    });

    it('+10ジャンプが無効の場合（残り10ページ以下）', () => {
      render(<Pagination total={200} page={15} perPage={10} basePath="/products" />);

      const jumpForwardButton = screen.getByText('+10').closest('a');
      expect(jumpForwardButton).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('ページ情報表示', () => {
    it('件数情報を表示', () => {
      render(<Pagination total={100} page={1} perPage={10} basePath="/products" />);

      // "1 - 10 / 100 件" の形式
      expect(screen.getByText(/1 - 10/)).toBeInTheDocument();
      expect(screen.getByText(/100/)).toBeInTheDocument();
    });

    it('total=0の場合は件数情報を表示しない', () => {
      // total=0の場合、totalPages=0となりnullを返す
      const { container } = render(<Pagination total={0} page={1} perPage={10} basePath="/products" />);

      expect(container.querySelector('nav')).toBeNull();
    });
  });

  describe('直接ページ入力', () => {
    it('5ページ以上で入力フォームを表示', () => {
      render(<Pagination total={100} page={1} perPage={10} basePath="/products" />);

      expect(screen.getByPlaceholderText('ページ番号')).toBeInTheDocument();
      expect(screen.getByText('移動')).toBeInTheDocument();
    });

    it('5ページ未満で入力フォームを表示しない', () => {
      render(<Pagination total={40} page={1} perPage={10} basePath="/products" />);

      expect(screen.queryByPlaceholderText('ページ番号')).not.toBeInTheDocument();
    });

    it('入力値の範囲を自動補正', () => {
      render(<Pagination total={100} page={1} perPage={10} basePath="/products" />);

      const input = screen.getByPlaceholderText('ページ番号') as HTMLInputElement;

      fireEvent.change(input, { target: { value: '999' } });
      expect(input.value).toBe('10'); // 最大ページに補正

      fireEvent.change(input, { target: { value: '0' } });
      expect(input.value).toBe('1'); // 最小ページに補正
    });

    it('無効な入力でボタンを無効化', () => {
      render(<Pagination total={100} page={1} perPage={10} basePath="/products" />);

      const submitButton = screen.getByText('移動');
      expect(submitButton).toBeDisabled();
    });

    it('有効な入力でボタンを有効化', () => {
      render(<Pagination total={100} page={1} perPage={10} basePath="/products" />);

      const input = screen.getByPlaceholderText('ページ番号');
      const submitButton = screen.getByText('移動');

      fireEvent.change(input, { target: { value: '5' } });
      expect(submitButton).not.toBeDisabled();
    });

    it('フォーム送信でルーター遷移', () => {
      render(<Pagination total={100} page={1} perPage={10} basePath="/products" />);

      const input = screen.getByPlaceholderText('ページ番号');
      const form = input.closest('form')!;

      fireEvent.change(input, { target: { value: '5' } });
      fireEvent.submit(form);

      expect(mockPush).toHaveBeenCalledWith('/products?page=5');
    });
  });

  describe('position prop', () => {
    it('position=bottomでマージントップを適用', () => {
      render(<Pagination total={100} page={1} perPage={10} basePath="/products" position="bottom" />);

      const nav = screen.getByRole('navigation');
      expect(nav.className).toContain('mt-');
    });

    it('position=topでマージンボトムを適用', () => {
      render(<Pagination total={100} page={1} perPage={10} basePath="/products" position="top" />);

      const nav = screen.getByRole('navigation');
      expect(nav.className).toContain('mb-');
    });
  });

  describe('aria-label', () => {
    it('ナビゲーションにaria-labelを設定', () => {
      render(<Pagination total={100} page={3} perPage={10} basePath="/products" />);

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveAttribute('aria-label', 'ページ 3 / 10');
    });
  });
});
