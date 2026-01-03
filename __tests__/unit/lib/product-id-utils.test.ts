/**
 * 品番（Product ID）ユーティリティのテスト
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeProductIdForSearch,
  stripAspPrefix,
  generateProductIdVariations,
  matchProductId,
  productIdToLikePattern,
  formatProductCodeForDisplay,
} from '@adult-v/shared/lib/product-id-utils';

describe('product-id-utils', () => {
  describe('normalizeProductIdForSearch', () => {
    it('小文字に変換', () => {
      expect(normalizeProductIdForSearch('MIDE-001')).toBe('mide001');
    });

    it('ハイフンを除去', () => {
      expect(normalizeProductIdForSearch('ABP-123')).toBe('abp123');
    });

    it('アンダースコアを除去', () => {
      expect(normalizeProductIdForSearch('ABP_123')).toBe('abp123');
    });

    it('スペースを除去', () => {
      expect(normalizeProductIdForSearch('ABP 123')).toBe('abp123');
    });

    it('前後の空白をトリム', () => {
      expect(normalizeProductIdForSearch('  MIDE-001  ')).toBe('mide001');
    });

    it('FANZAプレフィックス付きを処理', () => {
      expect(normalizeProductIdForSearch('FANZA-mide00001')).toBe('fanzamide00001');
    });

    it('既に正規化済みの場合はそのまま', () => {
      expect(normalizeProductIdForSearch('mide001')).toBe('mide001');
    });

    it('数字のみの品番', () => {
      expect(normalizeProductIdForSearch('123456')).toBe('123456');
    });

    it('DTIパターン（アンダースコア区切り）', () => {
      expect(normalizeProductIdForSearch('123456_01')).toBe('12345601');
    });
  });

  describe('stripAspPrefix', () => {
    it('FANZAプレフィックスを除去', () => {
      expect(stripAspPrefix('FANZA-mide00001')).toBe('mide00001');
    });

    it('MGSプレフィックスを除去', () => {
      expect(stripAspPrefix('MGS-259luxu-1234')).toBe('259luxu-1234');
    });

    it('DUGAプレフィックスを除去', () => {
      expect(stripAspPrefix('DUGA-abc123')).toBe('abc123');
    });

    it('CARIBBEANプレフィックスを除去', () => {
      expect(stripAspPrefix('CARIBBEAN-123456')).toBe('123456');
    });

    it('HEYDOUGAプレフィックスを除去', () => {
      expect(stripAspPrefix('HEYDOUGA-4037-PPV2543')).toBe('4037-PPV2543');
    });

    it('小文字プレフィックスも対応', () => {
      expect(stripAspPrefix('fanza-mide00001')).toBe('mide00001');
    });

    it('プレフィックスがない場合はそのまま', () => {
      expect(stripAspPrefix('MIDE-001')).toBe('MIDE-001');
    });

    it('プレフィックスのみ（ハイフンなし）は除去しない', () => {
      expect(stripAspPrefix('FANZAmide00001')).toBe('FANZAmide00001');
    });
  });

  describe('generateProductIdVariations', () => {
    describe('標準的な品番パターン', () => {
      it('MIDE-001の各種バリエーションを生成', () => {
        const variations = generateProductIdVariations('MIDE-001');
        expect(variations).toContain('MIDE-001');
        expect(variations).toContain('mide-001');
        expect(variations).toContain('MIDE001');
        expect(variations).toContain('mide001');
        expect(variations).toContain('MIDE-1');
        expect(variations).toContain('mide-1');
      });

      it('ゼロパディングバリエーションを生成', () => {
        const variations = generateProductIdVariations('MIDE-1');
        expect(variations).toContain('MIDE-001');
        expect(variations).toContain('mide001');
        expect(variations).toContain('MIDE-00001');
        expect(variations).toContain('mide00001');
      });
    });

    describe('FANZAパターン', () => {
      it('FANZAプレフィックス付きバリエーションを生成', () => {
        const variations = generateProductIdVariations('mide00001');
        expect(variations).toContain('mide00001');
        expect(variations).toContain('MIDE00001');
        expect(variations).toContain('FANZA-mide00001');
        expect(variations).toContain('fanza-mide00001');
      });

      it('FANZAプレフィックスを除去したバリエーションも生成', () => {
        const variations = generateProductIdVariations('FANZA-mide00001');
        expect(variations).toContain('FANZA-mide00001');
        expect(variations).toContain('mide00001');
      });
    });

    describe('MGSパターン', () => {
      it('259LUXU-1234のバリエーションを生成', () => {
        const variations = generateProductIdVariations('259LUXU-1234');
        expect(variations).toContain('259LUXU-1234');
        expect(variations).toContain('259luxu-1234');
        expect(variations).toContain('259LUXU1234');
        expect(variations).toContain('259luxu1234');
      });
    });

    describe('TMPパターン', () => {
      it('4037-PPV2543のバリエーションを生成', () => {
        const variations = generateProductIdVariations('4037-PPV2543');
        expect(variations).toContain('4037-PPV2543');
        expect(variations).toContain('4037-ppv2543');
        expect(variations).toContain('4037PPV2543');
        expect(variations).toContain('4037ppv2543');
      });
    });

    describe('DTIパターン', () => {
      it('123456_01のバリエーションを生成', () => {
        const variations = generateProductIdVariations('123456_01');
        expect(variations).toContain('123456_01');
        expect(variations).toContain('123456-01');
        expect(variations).toContain('12345601');
      });
    });

    describe('エッジケース', () => {
      it('空白をトリム', () => {
        const variations = generateProductIdVariations('  MIDE-001  ');
        expect(variations).toContain('MIDE-001');
      });

      it('重複を排除', () => {
        const variations = generateProductIdVariations('MIDE-001');
        const uniqueCount = new Set(variations).size;
        expect(variations.length).toBe(uniqueCount);
      });
    });
  });

  describe('matchProductId', () => {
    it('同一品番はマッチ', () => {
      expect(matchProductId('MIDE-001', 'MIDE-001')).toBe(true);
    });

    it('大文字小文字の違いはマッチ', () => {
      expect(matchProductId('MIDE-001', 'mide-001')).toBe(true);
    });

    it('ハイフンの有無はマッチ', () => {
      expect(matchProductId('MIDE-001', 'MIDE001')).toBe(true);
    });

    it('アンダースコアとハイフンはマッチ', () => {
      expect(matchProductId('ABP_123', 'ABP-123')).toBe(true);
    });

    it('異なる品番はマッチしない', () => {
      expect(matchProductId('MIDE-001', 'MIDE-002')).toBe(false);
    });

    it('異なるプレフィックスはマッチしない', () => {
      expect(matchProductId('MIDE-001', 'SSIS-001')).toBe(false);
    });
  });

  describe('productIdToLikePattern', () => {
    it('英字と数字の間にワイルドカードを挿入', () => {
      expect(productIdToLikePattern('MIDE-001')).toBe('mide%001');
    });

    it('ハイフンなしでも処理', () => {
      expect(productIdToLikePattern('MIDE001')).toBe('mide%001');
    });

    it('小文字に変換', () => {
      expect(productIdToLikePattern('ABP-123')).toBe('abp%123');
    });

    it('前後の空白をトリム', () => {
      expect(productIdToLikePattern('  MIDE-001  ')).toBe('mide%001');
    });
  });

  describe('formatProductCodeForDisplay', () => {
    describe('基本的なフォーマット', () => {
      it('既にハイフン区切りの場合はそのまま', () => {
        expect(formatProductCodeForDisplay('SSIS-865')).toBe('SSIS-865');
      });

      it('小文字を大文字に変換', () => {
        expect(formatProductCodeForDisplay('ssis-865')).toBe('SSIS-865');
      });

      it('ハイフンなしにハイフンを挿入', () => {
        expect(formatProductCodeForDisplay('SSIS00865')).toBe('SSIS-865');
      });

      it('先頭のゼロを除去', () => {
        expect(formatProductCodeForDisplay('SSIS-00865')).toBe('SSIS-865');
      });

      it('小文字ハイフンなしを正規化', () => {
        expect(formatProductCodeForDisplay('ssis00865')).toBe('SSIS-865');
      });
    });

    describe('数字プレフィックス除去', () => {
      it('107START-470のプレフィックス除去', () => {
        expect(formatProductCodeForDisplay('107START-470')).toBe('START-470');
      });

      it('118ABW00123のプレフィックス除去', () => {
        expect(formatProductCodeForDisplay('118ABW00123')).toBe('ABW-123');
      });
    });

    describe('h_プレフィックス除去', () => {
      it('h_1234abc00123のプレフィックス除去', () => {
        expect(formatProductCodeForDisplay('h_1234abc00123')).toBe('ABC-123');
      });

      it('H_0123MIDE00001のプレフィックス除去', () => {
        expect(formatProductCodeForDisplay('H_0123MIDE00001')).toBe('MIDE-1');
      });
    });

    describe('300シリーズ（シロウトTV系）', () => {
      it('300MIUM-1359は数字プレフィックスを保持', () => {
        expect(formatProductCodeForDisplay('300MIUM-1359')).toBe('300MIUM-1359');
      });

      it('300mium01359の正規化', () => {
        expect(formatProductCodeForDisplay('300mium01359')).toBe('300MIUM-1359');
      });
    });

    describe('エッジケース', () => {
      it('nullの場合はnullを返す', () => {
        expect(formatProductCodeForDisplay(null)).toBe(null);
      });

      it('undefinedの場合はnullを返す', () => {
        expect(formatProductCodeForDisplay(undefined)).toBe(null);
      });

      it('空文字の場合はnullを返す', () => {
        expect(formatProductCodeForDisplay('')).toBe(null);
      });

      it('空白のみの場合はnullを返す', () => {
        expect(formatProductCodeForDisplay('   ')).toBe(null);
      });

      it('数字のみの場合はそのまま大文字', () => {
        expect(formatProductCodeForDisplay('123456')).toBe('123456');
      });

      it('ゼロのみの場合', () => {
        expect(formatProductCodeForDisplay('ABC-000')).toBe('ABC-0');
      });
    });
  });
});
