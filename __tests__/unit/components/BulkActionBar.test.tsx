/**
 * BulkActionBarコンポーネントのテスト
 * 一括操作バーのテスト
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BulkActionBar, type BulkAction } from '@adult-v/shared/components';

describe('BulkActionBar', () => {
  const defaultActions: BulkAction[] = [
    {
      id: 'favorite',
      label: 'お気に入り追加',
      onClick: vi.fn(),
    },
    {
      id: 'delete',
      label: '削除',
      variant: 'danger',
      onClick: vi.fn(),
    },
  ];

  const defaultProps = {
    selectedCount: 3,
    selectedIds: ['1', '2', '3'],
    actions: defaultActions,
    onClearSelection: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('表示', () => {
    it('選択件数が0の場合は表示しない', () => {
      const { container } = render(<BulkActionBar {...defaultProps} selectedCount={0} selectedIds={[]} />);

      expect(container.firstChild).toBeNull();
    });

    it('選択件数が1以上の場合に表示', () => {
      render(<BulkActionBar {...defaultProps} />);

      // 「3件選択中」というテキストを含むことを確認
      expect(screen.getByText(/3件選択中/)).toBeInTheDocument();
    });

    it('アクションボタンを表示', () => {
      render(<BulkActionBar {...defaultProps} />);

      expect(screen.getByText('お気に入り追加')).toBeInTheDocument();
      expect(screen.getByText('削除')).toBeInTheDocument();
    });
  });

  describe('テーマ', () => {
    it('ダークテーマ（デフォルト）で表示', () => {
      render(<BulkActionBar {...defaultProps} theme="dark" />);

      // 親コンテナがbg-gray-800を含む
      const closeButton = screen.getByLabelText('Close');
      const container = closeButton.parentElement;
      expect(container?.className).toContain('bg-gray-800');
    });

    it('ライトテーマで表示', () => {
      render(<BulkActionBar {...defaultProps} theme="light" />);

      const closeButton = screen.getByLabelText('Close');
      const container = closeButton.parentElement;
      expect(container?.className).toContain('bg-white');
    });
  });

  describe('ローカライズ', () => {
    it('日本語（デフォルト）', () => {
      render(<BulkActionBar {...defaultProps} locale="ja" />);

      expect(screen.getByText('選択解除')).toBeInTheDocument();
    });

    it('英語', () => {
      render(<BulkActionBar {...defaultProps} locale="en" />);

      expect(screen.getByText('Clear selection')).toBeInTheDocument();
    });
  });

  describe('インタラクション', () => {
    it('選択解除ボタンでonClearSelectionが呼ばれる', () => {
      const onClearSelection = vi.fn();
      render(<BulkActionBar {...defaultProps} onClearSelection={onClearSelection} />);

      fireEvent.click(screen.getByText('選択解除'));

      expect(onClearSelection).toHaveBeenCalled();
    });

    it('閉じるボタンでonClearSelectionが呼ばれる', () => {
      const onClearSelection = vi.fn();
      render(<BulkActionBar {...defaultProps} onClearSelection={onClearSelection} />);

      const closeButton = screen.getByLabelText('Close');
      fireEvent.click(closeButton);

      expect(onClearSelection).toHaveBeenCalled();
    });

    it('アクションボタンクリックでonClickが呼ばれる', async () => {
      const onClick = vi.fn().mockResolvedValue(undefined);
      const actions: BulkAction[] = [{ id: 'test', label: 'テスト', onClick }];

      render(<BulkActionBar {...defaultProps} actions={actions} />);

      fireEvent.click(screen.getByText('テスト'));

      await waitFor(() => {
        expect(onClick).toHaveBeenCalledWith(['1', '2', '3']);
      });
    });
  });

  describe('すべて選択', () => {
    it('onSelectAllがある場合にボタン表示', () => {
      render(<BulkActionBar {...defaultProps} onSelectAll={vi.fn()} totalCount={10} />);

      expect(screen.getByText('すべて選択')).toBeInTheDocument();
    });

    it('すべて選択済みの場合はボタン非表示', () => {
      render(
        <BulkActionBar
          {...defaultProps}
          selectedCount={10}
          selectedIds={['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']}
          onSelectAll={vi.fn()}
          totalCount={10}
        />,
      );

      expect(screen.queryByText('すべて選択')).not.toBeInTheDocument();
    });

    it('すべて選択クリックでonSelectAllが呼ばれる', () => {
      const onSelectAll = vi.fn();
      render(<BulkActionBar {...defaultProps} onSelectAll={onSelectAll} totalCount={10} />);

      fireEvent.click(screen.getByText('すべて選択'));

      expect(onSelectAll).toHaveBeenCalled();
    });
  });

  describe('ローディング状態', () => {
    it('アクション実行中はローディング表示', async () => {
      const onClick = vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));
      const actions: BulkAction[] = [{ id: 'test', label: 'テスト', onClick }];

      render(<BulkActionBar {...defaultProps} actions={actions} />);

      fireEvent.click(screen.getByText('テスト'));

      await waitFor(() => {
        expect(screen.getByText('処理中...')).toBeInTheDocument();
      });
    });

    it('ローディング中は他のアクションボタンが無効', async () => {
      const slowAction = vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));
      const fastAction = vi.fn();
      const actions: BulkAction[] = [
        { id: 'slow', label: 'スロー', onClick: slowAction },
        { id: 'fast', label: 'ファスト', onClick: fastAction },
      ];

      render(<BulkActionBar {...defaultProps} actions={actions} />);

      fireEvent.click(screen.getByText('スロー'));

      // ローディング中にファストボタンが無効になっていることを確認
      await waitFor(() => {
        const fastButton = screen.getByText('ファスト').closest('button');
        expect(fastButton).toBeDisabled();
      });
    });
  });

  describe('アクションバリアント', () => {
    it('dangerバリアントのスタイル適用', () => {
      const actions: BulkAction[] = [{ id: 'delete', label: '削除', variant: 'danger', onClick: vi.fn() }];

      render(<BulkActionBar {...defaultProps} actions={actions} theme="dark" />);

      const button = screen.getByText('削除').closest('button');
      expect(button?.className).toContain('bg-red-600');
    });

    it('defaultバリアントのスタイル適用', () => {
      const actions: BulkAction[] = [{ id: 'add', label: '追加', onClick: vi.fn() }];

      render(<BulkActionBar {...defaultProps} actions={actions} theme="dark" />);

      const button = screen.getByText('追加').closest('button');
      expect(button?.className).toContain('bg-blue-600');
    });
  });
});
