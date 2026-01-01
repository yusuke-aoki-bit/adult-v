/**
 * 演者名バリデーションのテスト
 */
import { describe, it, expect } from 'vitest';
import {
  isValidPerformerName,
  normalizePerformerName,
  isValidPerformerForProduct,
} from '../../packages/crawlers/src/lib/performer-validation';

describe('Performer Validation', () => {
  describe('isValidPerformerName', () => {
    describe('有効な演者名', () => {
      it('should accept Japanese names', () => {
        expect(isValidPerformerName('三上悠亜')).toBe(true);
        expect(isValidPerformerName('橋本ありな')).toBe(true);
        expect(isValidPerformerName('あおいれな')).toBe(true);
      });

      it('should accept names with spaces', () => {
        expect(isValidPerformerName('天使 もえ')).toBe(true);
        expect(isValidPerformerName('美波 ゆさ')).toBe(true);
      });

      it('should accept foreign names', () => {
        expect(isValidPerformerName('Anna')).toBe(true);
        expect(isValidPerformerName('Lisa Rose')).toBe(true);
        expect(isValidPerformerName('Maria Ozawa')).toBe(true);
      });

      it('should accept names with numbers (valid cases)', () => {
        expect(isValidPerformerName('JULIA')).toBe(true);
        expect(isValidPerformerName('Rio')).toBe(true);
      });

      it('should accept mixed Japanese/English names', () => {
        expect(isValidPerformerName('JULIAちゃん')).toBe(true);
      });
    });

    describe('無効な演者名', () => {
      it('should reject empty or whitespace', () => {
        expect(isValidPerformerName('')).toBe(false);
        expect(isValidPerformerName('   ')).toBe(false);
      });

      it('should reject single characters', () => {
        expect(isValidPerformerName('あ')).toBe(false);
        expect(isValidPerformerName('A')).toBe(false);
        expect(isValidPerformerName('亜')).toBe(false);
      });

      it('should reject numbers only', () => {
        expect(isValidPerformerName('12345')).toBe(false);
        expect(isValidPerformerName('1')).toBe(false);
      });

      it('should reject product code patterns', () => {
        expect(isValidPerformerName('SSIS-865')).toBe(false);
        expect(isValidPerformerName('ABW-123')).toBe(false);
      });

      it('should reject placeholder values', () => {
        expect(isValidPerformerName('---')).toBe(false);
        expect(isValidPerformerName('...')).toBe(false);
        expect(isValidPerformerName('N/A')).toBe(false);
        expect(isValidPerformerName('unknown')).toBe(false);
      });

      it('should reject generic terms', () => {
        expect(isValidPerformerName('素人')).toBe(false);
        expect(isValidPerformerName('他')).toBe(false);
        expect(isValidPerformerName('出演者')).toBe(false);
        expect(isValidPerformerName('AV女優')).toBe(false);
      });

      it('should reject ASP/site names', () => {
        expect(isValidPerformerName('MGS')).toBe(false);
        expect(isValidPerformerName('FANZA')).toBe(false);
        expect(isValidPerformerName('DMM')).toBe(false);
        expect(isValidPerformerName('DUGA')).toBe(false);
      });

      it('should reject date patterns', () => {
        expect(isValidPerformerName('2025年10月')).toBe(false);
        expect(isValidPerformerName('10月15日')).toBe(false);
        expect(isValidPerformerName('2025/10/15')).toBe(false);
      });

      it('should reject count/duration patterns', () => {
        expect(isValidPerformerName('116枚')).toBe(false);
        expect(isValidPerformerName('120分')).toBe(false);
        expect(isValidPerformerName('1,980円')).toBe(false);
      });

      it('should reject genre/play names', () => {
        expect(isValidPerformerName('巨乳')).toBe(false);
        expect(isValidPerformerName('中出し')).toBe(false);
        expect(isValidPerformerName('フェラ')).toBe(false);
      });

      it('should reject URLs and HTML', () => {
        expect(isValidPerformerName('https://example.com')).toBe(false);
        expect(isValidPerformerName('<a href="#">test</a>')).toBe(false);
      });
    });

    describe('エッジケース', () => {
      it('should handle names with arrows (conversion errors)', () => {
        expect(isValidPerformerName('→あいうえお')).toBe(false);
        expect(isValidPerformerName('山田→田中')).toBe(false);
      });

      it('should reject series/label names', () => {
        expect(isValidPerformerName('ラグジュTV')).toBe(false);
        expect(isValidPerformerName('俺の素人')).toBe(false);
      });
    });
  });

  describe('normalizePerformerName', () => {
    it('should trim whitespace', () => {
      expect(normalizePerformerName('  三上悠亜  ')).toBe('三上悠亜');
    });

    it('should remove spaces in Japanese names', () => {
      // 日本語名の場合はスペースを削除する仕様
      expect(normalizePerformerName('三上　悠亜')).toBe('三上悠亜');
      expect(normalizePerformerName('三上  悠亜')).toBe('三上悠亜');
    });

    it('should preserve spaces in English names', () => {
      expect(normalizePerformerName('Maria  Ozawa')).toBe('Maria Ozawa');
    });

    it('should handle mixed width characters', () => {
      const result = normalizePerformerName('ABCD');
      expect(result).toBe('ABCD');
    });

    it('should remove reading in parentheses', () => {
      // 名前の途中にある括弧+読み仮名を削除（末尾の括弧は先に記号として削除される）
      expect(normalizePerformerName('山田花子（やまだはなこ）さん')).toBe('山田花子さん');
      // 半角括弧のケース
      expect(normalizePerformerName('山田花子(やまだはなこ)さん')).toBe('山田花子さん');
    });
  });

  describe('isValidPerformerForProduct', () => {
    it('should validate performer in product context', () => {
      expect(isValidPerformerForProduct('三上悠亜', 'SSIS-865')).toBe(true);
      expect(isValidPerformerForProduct('', 'SSIS-865')).toBe(false);
    });

    it('should reject product code as performer name', () => {
      expect(isValidPerformerForProduct('SSIS-865', 'SSIS-865')).toBe(false);
    });
  });
});
