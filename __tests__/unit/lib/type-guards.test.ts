/**
 * 型ガードユーティリティのテスト
 */
import { describe, it, expect } from 'vitest';
import {
  isNotNullish,
  isString,
  isNumber,
  isPositiveInteger,
  isObject,
  isArray,
  hasProperty,
  isDbRow,
  hasPerformerId,
  extractPerformerIds,
  hasId,
  extractIds,
  hasProductId,
  extractProductIds,
  hasCount,
  hasAspName,
  compact,
  toNumber,
  toString,
  getNumberField,
  getStringField,
  getDateField,
  getBooleanField,
  getStringArrayField,
  toPerformerRows,
  toTagRows,
  toSourceRow,
  toImageRows,
  toVideoRows,
  toBatchSourceRows,
  toBatchImageRows,
  toBatchVideoRows,
  toBatchSaleRows,
  extractRowsArray,
} from '@adult-v/shared/lib/type-guards';

describe('type-guards', () => {
  describe('isNotNullish', () => {
    it('nullはfalse', () => {
      expect(isNotNullish(null)).toBe(false);
    });

    it('undefinedはfalse', () => {
      expect(isNotNullish(undefined)).toBe(false);
    });

    it('0はtrue', () => {
      expect(isNotNullish(0)).toBe(true);
    });

    it('空文字はtrue', () => {
      expect(isNotNullish('')).toBe(true);
    });

    it('falseはtrue', () => {
      expect(isNotNullish(false)).toBe(true);
    });

    it('オブジェクトはtrue', () => {
      expect(isNotNullish({})).toBe(true);
    });
  });

  describe('isString', () => {
    it('文字列はtrue', () => {
      expect(isString('hello')).toBe(true);
    });

    it('空文字はtrue', () => {
      expect(isString('')).toBe(true);
    });

    it('数値はfalse', () => {
      expect(isString(123)).toBe(false);
    });

    it('nullはfalse', () => {
      expect(isString(null)).toBe(false);
    });
  });

  describe('isNumber', () => {
    it('数値はtrue', () => {
      expect(isNumber(123)).toBe(true);
    });

    it('0はtrue', () => {
      expect(isNumber(0)).toBe(true);
    });

    it('小数はtrue', () => {
      expect(isNumber(1.5)).toBe(true);
    });

    it('負数はtrue', () => {
      expect(isNumber(-10)).toBe(true);
    });

    it('NaNはfalse', () => {
      expect(isNumber(NaN)).toBe(false);
    });

    it('文字列はfalse', () => {
      expect(isNumber('123')).toBe(false);
    });
  });

  describe('isPositiveInteger', () => {
    it('正の整数はtrue', () => {
      expect(isPositiveInteger(1)).toBe(true);
      expect(isPositiveInteger(100)).toBe(true);
    });

    it('0はfalse', () => {
      expect(isPositiveInteger(0)).toBe(false);
    });

    it('負の整数はfalse', () => {
      expect(isPositiveInteger(-1)).toBe(false);
    });

    it('小数はfalse', () => {
      expect(isPositiveInteger(1.5)).toBe(false);
    });

    it('文字列はfalse', () => {
      expect(isPositiveInteger('1')).toBe(false);
    });
  });

  describe('isObject', () => {
    it('オブジェクトはtrue', () => {
      expect(isObject({})).toBe(true);
      expect(isObject({ a: 1 })).toBe(true);
    });

    it('nullはfalse', () => {
      expect(isObject(null)).toBe(false);
    });

    it('配列はfalse', () => {
      expect(isObject([])).toBe(false);
    });

    it('関数はfalse', () => {
      expect(isObject(() => {})).toBe(false);
    });

    it('プリミティブはfalse', () => {
      expect(isObject('string')).toBe(false);
      expect(isObject(123)).toBe(false);
    });
  });

  describe('isArray', () => {
    it('配列はtrue', () => {
      expect(isArray([])).toBe(true);
      expect(isArray([1, 2, 3])).toBe(true);
    });

    it('オブジェクトはfalse', () => {
      expect(isArray({})).toBe(false);
    });

    it('文字列はfalse', () => {
      expect(isArray('array')).toBe(false);
    });
  });

  describe('hasProperty', () => {
    it('プロパティが存在する場合はtrue', () => {
      expect(hasProperty({ name: 'test' }, 'name')).toBe(true);
    });

    it('プロパティが存在しない場合はfalse', () => {
      expect(hasProperty({ name: 'test' }, 'id')).toBe(false);
    });

    it('値がundefinedでもプロパティがあればtrue', () => {
      expect(hasProperty({ name: undefined }, 'name')).toBe(true);
    });

    it('nullはfalse', () => {
      expect(hasProperty(null, 'name')).toBe(false);
    });

    it('配列はfalse', () => {
      expect(hasProperty([], 'length')).toBe(false);
    });
  });

  describe('isDbRow', () => {
    it('必要なキーがすべて存在する場合はtrue', () => {
      const row = { id: 1, name: 'test', value: 100 };
      expect(isDbRow(row, ['id', 'name'])).toBe(true);
    });

    it('キーが不足している場合はfalse', () => {
      const row = { id: 1 };
      expect(isDbRow(row, ['id', 'name'])).toBe(false);
    });

    it('オブジェクトでない場合はfalse', () => {
      expect(isDbRow('not an object', ['id'])).toBe(false);
    });
  });

  describe('hasPerformerId', () => {
    it('performerIdが数値の場合はtrue', () => {
      expect(hasPerformerId({ performerId: 123 })).toBe(true);
    });

    it('performerIdが文字列の場合はfalse', () => {
      expect(hasPerformerId({ performerId: '123' })).toBe(false);
    });

    it('performerIdがない場合はfalse', () => {
      expect(hasPerformerId({ id: 123 })).toBe(false);
    });
  });

  describe('extractPerformerIds', () => {
    it('有効なperformerIdを抽出', () => {
      const rows = [{ performerId: 1 }, { performerId: 2 }, { performerId: 3 }];
      expect(extractPerformerIds(rows)).toEqual([1, 2, 3]);
    });

    it('無効な値をフィルタリング', () => {
      const rows = [{ performerId: 1 }, { performerId: '2' }, { performerId: null }, { performerId: 4 }];
      expect(extractPerformerIds(rows)).toEqual([1, 4]);
    });
  });

  describe('hasId', () => {
    it('idが数値の場合はtrue', () => {
      expect(hasId({ id: 123 })).toBe(true);
    });

    it('idが文字列の場合はfalse', () => {
      expect(hasId({ id: '123' })).toBe(false);
    });
  });

  describe('extractIds', () => {
    it('有効なidを抽出', () => {
      const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
      expect(extractIds(rows)).toEqual([1, 2, 3]);
    });

    it('無効な値をフィルタリング', () => {
      const rows = [{ id: 1 }, { id: '2' }, { id: 3 }];
      expect(extractIds(rows)).toEqual([1, 3]);
    });
  });

  describe('hasProductId', () => {
    it('productIdが数値の場合はtrue', () => {
      expect(hasProductId({ productId: 123 })).toBe(true);
    });

    it('productIdが文字列の場合はfalse', () => {
      expect(hasProductId({ productId: '123' })).toBe(false);
    });
  });

  describe('extractProductIds', () => {
    it('有効なproductIdを抽出', () => {
      const rows = [{ productId: 1 }, { productId: 2 }];
      expect(extractProductIds(rows)).toEqual([1, 2]);
    });
  });

  describe('hasCount', () => {
    it('countが数値の場合はtrue', () => {
      expect(hasCount({ count: 10 })).toBe(true);
    });

    it('countが文字列の場合はtrue', () => {
      expect(hasCount({ count: '10' })).toBe(true);
    });

    it('countがない場合はfalse', () => {
      expect(hasCount({ value: 10 })).toBe(false);
    });
  });

  describe('hasAspName', () => {
    it('aspNameが文字列の場合はtrue', () => {
      expect(hasAspName({ aspName: 'FANZA' })).toBe(true);
    });

    it('aspNameが数値の場合はfalse', () => {
      expect(hasAspName({ aspName: 123 })).toBe(false);
    });
  });

  describe('compact', () => {
    it('nullとundefinedを除外', () => {
      const arr = [1, null, 2, undefined, 3, null];
      expect(compact(arr)).toEqual([1, 2, 3]);
    });

    it('0や空文字は保持', () => {
      const arr = [0, '', false, null];
      expect(compact(arr)).toEqual([0, '', false]);
    });

    it('空配列は空配列を返す', () => {
      expect(compact([])).toEqual([]);
    });
  });

  describe('toNumber', () => {
    it('数値はそのまま返す', () => {
      expect(toNumber(123)).toBe(123);
    });

    it('文字列の数値をパース', () => {
      expect(toNumber('123')).toBe(123);
      expect(toNumber('1.5')).toBe(1.5);
    });

    it('パースできない文字列はundefined', () => {
      expect(toNumber('abc')).toBe(undefined);
    });

    it('nullはundefined', () => {
      expect(toNumber(null)).toBe(undefined);
    });
  });

  describe('toString', () => {
    it('文字列はそのまま返す', () => {
      expect(toString('hello')).toBe('hello');
    });

    it('数値を文字列に変換', () => {
      expect(toString(123)).toBe('123');
    });

    it('nullはundefined', () => {
      expect(toString(null)).toBe(undefined);
    });

    it('undefinedはundefined', () => {
      expect(toString(undefined)).toBe(undefined);
    });
  });

  describe('getNumberField', () => {
    it('数値フィールドを取得', () => {
      expect(getNumberField({ price: 1000 }, 'price')).toBe(1000);
    });

    it('フィールドがない場合はundefined', () => {
      expect(getNumberField({}, 'price')).toBe(undefined);
    });

    it('数値以外はundefined', () => {
      expect(getNumberField({ price: '1000' }, 'price')).toBe(undefined);
    });
  });

  describe('getStringField', () => {
    it('文字列フィールドを取得', () => {
      expect(getStringField({ name: 'test' }, 'name')).toBe('test');
    });

    it('フィールドがない場合はundefined', () => {
      expect(getStringField({}, 'name')).toBe(undefined);
    });
  });

  describe('getDateField', () => {
    it('Dateオブジェクトを取得', () => {
      const date = new Date('2024-01-01');
      expect(getDateField({ createdAt: date }, 'createdAt')).toEqual(date);
    });

    it('ISO文字列をパース', () => {
      const result = getDateField({ createdAt: '2024-01-01' }, 'createdAt');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
    });

    it('無効な日付文字列はundefined', () => {
      expect(getDateField({ createdAt: 'invalid' }, 'createdAt')).toBe(undefined);
    });
  });

  describe('getBooleanField', () => {
    it('booleanフィールドを取得', () => {
      expect(getBooleanField({ active: true }, 'active')).toBe(true);
      expect(getBooleanField({ active: false }, 'active')).toBe(false);
    });

    it('boolean以外はundefined', () => {
      expect(getBooleanField({ active: 1 }, 'active')).toBe(undefined);
    });
  });

  describe('getStringArrayField', () => {
    it('文字列配列を取得', () => {
      expect(getStringArrayField({ tags: ['a', 'b'] }, 'tags')).toEqual(['a', 'b']);
    });

    it('空配列も取得', () => {
      expect(getStringArrayField({ tags: [] }, 'tags')).toEqual([]);
    });

    it('数値配列はundefined', () => {
      expect(getStringArrayField({ tags: [1, 2] }, 'tags')).toBe(undefined);
    });

    it('混合配列はundefined', () => {
      expect(getStringArrayField({ tags: ['a', 1] }, 'tags')).toBe(undefined);
    });
  });

  describe('toPerformerRows', () => {
    it('PerformerRow配列に変換', () => {
      const rows = [
        { id: 1, name: 'Performer 1', nameKana: 'カナ1' },
        { id: 2, name: 'Performer 2', nameKana: null },
      ];
      const result = toPerformerRows(rows);
      expect(result).toEqual([
        { id: 1, name: 'Performer 1', nameKana: 'カナ1' },
        { id: 2, name: 'Performer 2', nameKana: null },
      ]);
    });

    it('欠損値にデフォルト値を設定', () => {
      const rows = [{}];
      const result = toPerformerRows(rows);
      expect(result[0]!).toEqual({ id: 0, name: '', nameKana: null });
    });
  });

  describe('toTagRows', () => {
    it('TagRow配列に変換', () => {
      const rows = [
        { id: 1, name: 'Tag 1', category: 'genre' },
        { id: 2, name: 'Tag 2', category: null },
      ];
      const result = toTagRows(rows);
      expect(result).toEqual([
        { id: 1, name: 'Tag 1', category: 'genre' },
        { id: 2, name: 'Tag 2', category: null },
      ]);
    });
  });

  describe('toSourceRow', () => {
    it('SourceRowに変換', () => {
      const row = {
        aspName: 'FANZA',
        originalProductId: 'mide00001',
        affiliateUrl: 'https://example.com',
        price: 1000,
        currency: 'JPY',
      };
      const result = toSourceRow(row);
      expect(result).toEqual({
        aspName: 'FANZA',
        originalProductId: 'mide00001',
        affiliateUrl: 'https://example.com',
        price: 1000,
        currency: 'JPY',
      });
    });

    it('nullまたはundefinedはundefinedを返す', () => {
      expect(toSourceRow(null)).toBe(undefined);
      expect(toSourceRow(undefined)).toBe(undefined);
    });
  });

  describe('toImageRows', () => {
    it('ImageRow配列に変換', () => {
      const rows = [{ productId: 1, imageUrl: 'url1', imageType: 'thumbnail', displayOrder: 1 }];
      const result = toImageRows(rows);
      expect(result[0]!).toEqual({
        productId: 1,
        imageUrl: 'url1',
        imageType: 'thumbnail',
        displayOrder: 1,
      });
    });
  });

  describe('toVideoRows', () => {
    it('VideoRow配列に変換', () => {
      const rows = [{ productId: 1, videoUrl: 'url1', videoType: 'sample', quality: 'HD', duration: 120 }];
      const result = toVideoRows(rows);
      expect(result[0]!).toEqual({
        productId: 1,
        videoUrl: 'url1',
        videoType: 'sample',
        quality: 'HD',
        duration: 120,
      });
    });
  });

  describe('toBatchSourceRows（スネーク/キャメル両対応）', () => {
    it('キャメルケースを変換', () => {
      const rows = [{ productId: 1, aspName: 'FANZA', originalProductId: 'abc' }];
      const result = toBatchSourceRows(rows);
      expect(result[0]!.productId).toBe(1);
      expect(result[0]!.aspName).toBe('FANZA');
    });

    it('スネークケースを変換', () => {
      const rows = [{ product_id: 1, asp_name: 'FANZA', original_product_id: 'abc' }];
      const result = toBatchSourceRows(rows);
      expect(result[0]!.productId).toBe(1);
      expect(result[0]!.aspName).toBe('FANZA');
    });
  });

  describe('toBatchImageRows', () => {
    it('スネークケースを変換', () => {
      const rows = [{ product_id: 1, image_url: 'url', image_type: 'thumbnail', display_order: 1 }];
      const result = toBatchImageRows(rows);
      expect(result[0]!).toEqual({
        productId: 1,
        imageUrl: 'url',
        imageType: 'thumbnail',
        displayOrder: 1,
      });
    });
  });

  describe('toBatchVideoRows', () => {
    it('スネークケースを変換', () => {
      const rows = [{ product_id: 1, video_url: 'url', video_type: 'sample', quality: 'HD', duration: 120 }];
      const result = toBatchVideoRows(rows);
      expect(result[0]!).toEqual({
        productId: 1,
        videoUrl: 'url',
        videoType: 'sample',
        quality: 'HD',
        duration: 120,
      });
    });
  });

  describe('toBatchSaleRows', () => {
    it('スネークケースを変換', () => {
      const rows = [{ product_id: 1, regular_price: 1000, sale_price: 800, discount_percent: 20, end_at: null }];
      const result = toBatchSaleRows(rows);
      expect(result[0]!).toEqual({
        productId: 1,
        regularPrice: 1000,
        salePrice: 800,
        discountPercent: 20,
        endAt: null,
      });
    });
  });

  describe('extractRowsArray', () => {
    it('配列はそのまま返す', () => {
      const arr = [1, 2, 3];
      expect(extractRowsArray(arr)).toEqual([1, 2, 3]);
    });

    it('rowsプロパティを持つオブジェクトからrows配列を抽出', () => {
      const obj = { rows: [1, 2, 3] };
      expect(extractRowsArray(obj)).toEqual([1, 2, 3]);
    });

    it('それ以外は空配列を返す', () => {
      expect(extractRowsArray({})).toEqual([]);
      expect(extractRowsArray(null)).toEqual([]);
      expect(extractRowsArray('string')).toEqual([]);
    });
  });
});
